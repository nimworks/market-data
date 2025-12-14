const fs = require('fs');
const zlib = require('zlib');
const https = require('https');
// const http = require('http');	//when reading sample data served via http://localhost
const path = require('path');
const { StringDecoder } = require('string_decoder');
// const { Readable } = require('stream');

//https://xstream.5paisa.com/dev-docs/docFundamentals/scrip-master
try {
	//https://Openapi.5paisa.com/VendorsAPI/Service1.svc/ScripMaster/segment/{segment}
	// Segment:
	// all - scrips across all segments
	// bse_eq - BSE Equity,
	// nse_eq - NSE Equity
	// nse_fo - NSE Derivatives
	// bse_fo - BSE Derivatives
	// ncd_fo - NSE Currecny
	// mcx_fo - MCX
	Promise.all([
		fetchAndProcessData('nse_eq', 'symbol/token,name,lots', nseFilterColumns, 'NSE.csv.gz'), //NSE
		fetchAndProcessData('bse_eq', 'symbol/token,name,lots', bseFilterColumns, 'BSE.csv.gz'), //BSE
		fetchAndProcessData('nse_fo', 'symbol|type|expiry|strike/token,lotsize', derivativesFilterColumns, 'NFO.csv.gz'), //NFO
		fetchAndProcessData('ncd_fo', 'symbol|type|expiry|strike/token,lotsize', derivativesFilterColumns, 'CDS.csv.gz'), //CDS
		fetchAndProcessData('mcx_fo', 'symbol|type|expiry|strike/token,lotsize', derivativesFilterColumns, 'MCX.csv.gz'), //MCX
	])
		.then(() => console.log('All files processed successfully'))
		.catch((err) => console.error('Error in processing:', err));

	//TEST USING SAMPLE DATA FROM 'src/sampleData' MADE AVAIALBLE VIA LOCAL http SERVER
	// Promise.all([
	// 	fetchAndProcessData('nse_eq.csv.txt', 'symbol/token,name,lots', nseFilterColumns, 'NSE.csv.gz'), //NSE
	// 	fetchAndProcessData('bse_eq.csv.txt', 'symbol/token,name,lots', bseFilterColumns, 'BSE.csv.gz'), //BSE
	// 	fetchAndProcessData('nse_fo.csv.txt', 'symbol|type|expiry|strike/token,lotsize', derivativesFilterColumns, 'NFO.csv.gz'), //NFO
	// 	fetchAndProcessData('ncd_fo.csv.txt', 'symbol|type|expiry|strike/token,lotsize', derivativesFilterColumns, 'CDS.csv.gz'), //CDS
	// 	fetchAndProcessData('mcx_fo.csv.txt', 'symbol|type|expiry|strike/token,lotsize', derivativesFilterColumns, 'MCX.csv.gz'), //MCX
	// ])
	// 	.then(() => console.log('All files processed successfully'))
	// 	.catch((err) => console.error('Error in processing:', err));
} catch (err) {
	console.error('ERROR fetching and processing of data', err);
}

//======================+
//		HELPER FNS		|
//======================+

/** Fetches CSV file from url and uses callback function to process the data
 * @param {string} segment Shall be appended to url path to fetch CSV data from
 * @param {string} headerColumnTitles Header column title to write in output file
 * @param {(csvLine:string)=>string} csvColumnsFilterFn Callback function to filter columns from CSV row data fetched from above url
 * @param {string} zippedOutputFileName Output file
 * @returns {Promise} returns a promise
 */
// function fetchAndProcessData(segment, csvColumnsFilterFn) {
function fetchAndProcessData(segment, headerColumnTitles, csvColumnsFilterFn, zippedOutputFileName) {
	// function fetchAndProcessData(url, csvColumnsFilterFn) {
	return new Promise(function (resolve, reject) {
		const outputDirPath = path.resolve(__dirname, '../../public/5paisa');
		const outputFilePath = path.join(outputDirPath, zippedOutputFileName);
		// Ensure directory exists
		if (!fs.existsSync(outputDirPath)) {
			fs.mkdirSync(outputDirPath, { recursive: true });
		}

		const gzip = zlib.createGzip();
		// const outStream = fs.createWriteStream(path.resolve(__dirname, `../../public/5paisa/${zippedOutputFileName}`));
		const outStream = fs.createWriteStream(outputFilePath);
		gzip.pipe(outStream);

		// When you use gzip.pipe(outStream), Node automatically calls outStream.end() when the gzip stream finishes.
		// Optional: listen for otstream completion
		outStream.on('finish', () => {
			// console.log('Gzip file written successfully');
			console.log(segment + ' CSV data written to ' + zippedOutputFileName);
		});

		// https.get(url, (response) => {
		// http.get(
		// 		{
		// 			hostname: '127.0.0.1',
		// 			port: '8080',
		// 			path: '/5paisa/' + segment, //folder within src/sampleData
		// 			headers: {
		// 				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
		// 			}
		// 		}
		https
			.get(
				{
					hostname: 'Openapi.5paisa.com',
					path: '/VendorsAPI/Service1.svc/ScripMaster/segment/' + segment, //'/VendorsAPI/Service1.svc/ScripMaster/segment/{segment}',
					headers: {
						'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
						//desktop chrome --> Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36
						//desktop firefox --> Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:114.0) Gecko/20100101 Firefox/114.0

						// Accept: '*/*',
						// 'Accept-Encoding': 'gzip',
					},
				},
				(response) => {
					if (response.statusCode !== 200) {
						reject(`Failed to fetch ${segment} CSV: ${response.statusCode}`);
						return;
					}
					gzip.write(headerColumnTitles);

					// const gunzip = zlib.createGunzip();
					const decoder = new StringDecoder('utf8');
					let buffer = ''; //since we are parsing data as soon as it arrives, this buffer shall only load part of data temporarily, thus being memory efficient

					// response.pipe(gunzip).on('data',(chunk)=>{})
					response
						.on('data', (chunk) => {
							// const textChunk = chunk.toString('utf8');
							const textChunk = decoder.write(chunk); // Use the decoder to safely decode the current chunk
							// console.log('Received:', textChunk);

							buffer += textChunk; //.toString();

							//here we can start processing on data as soon as chunks arrive
							let lines = buffer.split('\n'); // split into lines
							buffer = lines.pop(); // keep incomplete line in buffer, since incoming chunk may not have reach CSV row end newline char

							for (const line of lines) {
								// console.log('line:', line);
								if (line.trim() === '') continue;
								if (line.startsWith('Exch,ExchType,ScripCode')) continue; //skip the header
								// const fields = line.split(','); // naive split
								// csvColumnsFilterFn(fields);
								const filteredLineStr = csvColumnsFilterFn(line);
								// console.log('filteredLineStr:', filteredLineStr);
								// Write filtered row back out as CSV line
								if (filteredLineStr !== '') gzip.write('\n' + filteredLineStr);
							}
							// NOTE: We may also look into first collecting all items in buffer (although that would up the memory use) and process the buffer afterwards
							//since that way we are only calling the processing fn per line, instead of when data chunks arrive which is more predictable
							//SInce if the chunks arrive in smaller size (ie not even completing one row), we may end up calling the splitting fn numberous times
						})
						.on('end', () => {
							// Process any remaining line
							if (buffer.trim() !== '') {
								// const fields = buffer.split(',');
								// rowHandlerFn(fields);
								const filteredLineStr = csvColumnsFilterFn(buffer); //process last CSV line if any in buffer
								if (filteredLineStr !== '') gzip.write('\n' + filteredLineStr);
							}
							gzip.end(); // finalize gzip stream
							console.log(segment + ' CSV file parsed successfully');
							//  const buffer = Buffer.concat(chunks).toString();
							// resolve(csvColumnsFilterFn(buffer));
							resolve();
						})
						.on('error', (err) => {
							gzip.end(); // finalize gzip stream
							console.error(`Error parsing ${segment} CSV file:`, err);
							reject(err);
						});
				},
			)
			.on('error', (err) => {
				console.error('Error fetching data:', err);
				gzip.end();
				reject(err);
			});
	});
}

function nseFilterColumns(line) {
	try {
		const columns = line.split(',');
		if (columns.length > 2 && (columns[16].trim() == 'EQ' || columns[16].trim() == 'SM')) {
			if (columns[8] != 0) {
				//if ticksize is not  0, we have tradeable instruments
				return `${columns[3]}/${columns[2]},${columns[7]},${columns[9]}`; //symbol,token,full-name,lotsize
			} else {
				return `${columns[3]}/${columns[2]},,`; //symbol,token,,
			}
		}
		return '';
	} catch (err) {
		console.error(err);
		return '';
	}
}

function bseFilterColumns(line) {
	try {
		const columns = line.split(',');
		if (columns.length > 2) {
			if (columns[8] != 0) {
				//if ticksize is not  0, we have tradeable instruments
				return `${columns[3]}/${columns[2]},${columns[7]},${columns[9]}`; //symbol,token,full-name,lotsize
			} else {
				return `${columns[3]}/${columns[2]},,`; //symbol,token,,
			}
		}
		return '';
	} catch (err) {
		console.error(err);
		return '';
	}
}

function derivativesFilterColumns(line) {
	try {
		const columns = line.split(',');
		if (columns.length > 2) {
			if (columns[5] === 'CE') {
				return `${columns[12]}|C|${columns[4]}|${columns[6]}/${columns[2]},${columns[9]}`; //symbol|C|expiry|strike/token,lotsize
			} else if (columns[5] === 'PE') {
				return `${columns[12]}|P|${columns[4]}|${columns[6]}/${columns[2]},${columns[9]}`; //symbol|P|expiry|strike/token,lotsize
			} else if (columns[5] === 'XX') {
				return `${columns[12]}|F|${columns[4]}|/${columns[2]},${columns[9]}`; //symbol|F|expiry|/token,lotsize
			}
		}
		return '';
	} catch (err) {
		console.error(err);
		return '';
	}
}
