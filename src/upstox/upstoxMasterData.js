const fs = require('fs');
const zlib = require('zlib');
const https = require('https');
const path = require('path');
const { Readable } = require('stream');

//https://upstox.com/developer/api-documentation/instruments#sample-json-object
//https://upstox.com/developer/api-documentation/appendix/field-pattern/

try {
	// Promise.all([
	// 	fetchAndProcessData('https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz', nseJson_to_nseNfoCds_csv),
	// 	fetchAndProcessData('https://assets.upstox.com/market-quote/instruments/exchange/BSE.json.gz', bseJson_to_csv),
	// 	fetchAndProcessData('https://assets.upstox.com/market-quote/instruments/exchange/MCX.json.gz', mcxJson_to_csv),
	// ])
	// 	.then(() => console.log('All files processed successfully'))
	// 	.catch((err) => console.error('Error in processing:', err));

	Promise.all([
		fetchAndProcessData('/market-quote/instruments/exchange/NSE.json.gz', nseJson_to_nseNfoCds_csv),
		fetchAndProcessData('/market-quote/instruments/exchange/BSE.json.gz', bseJson_to_csv),
		fetchAndProcessData('/market-quote/instruments/exchange/MCX.json.gz', mcxJson_to_csv),
	])
		.then(() => console.log('All files processed successfully'))
		.catch((err) => console.error('Error in processing:', err));
} catch (err) {
	console.error('ERROR fetching and processing of data', err);
}

//======================+
//		HELPER FNS		|
//======================+

/** Fetches gzipped JSON file from url, decompresses it and uses callback function to process the data
 * @param {string} urlPath Url path to fetch gzipped data from
 * @param {(jsonDataString:string)=>{}} dataProcessingFn CAllback function to process the data fetched from above url
 * @returns {Promise} returns a promise
 */
function fetchAndProcessData(urlPath, dataProcessingFn) {
	// function fetchAndProcessData(url, dataProcessingFn) {
	return new Promise(function (resolve, reject) {
		// https.get(url, (response) => {
		https
			.get(
				{
					hostname: 'assets.upstox.com',
					path: urlPath, //'/market-quote/instruments/exchange/NSE.json.gz',
					headers: {
						'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
						//desktop chrome --> Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36
						//desktop firefox --> Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:114.0) Gecko/20100101 Firefox/114.0

						// Accept: '*/*',
						'Accept-Encoding': 'gzip',
					},
				},
				(response) => {
					const gunzip = zlib.createGunzip();
					let jsonDataString = '';
					// let chunks = [];

					// console.log('RESPONSE-HEADERS:', response.headers);
					if (response.headers['content-type'] !== 'application/gzip') {
						// console.log('File being read from ' + url + ' is not a GZIP file');
						reject('File being read from https://assets.upstox.com' + urlPath + ' is not a GZIP file');
						return;
						// throw new Error('File being read from ' + url + ' is not a GZIP file');
					}

					response
						.pipe(gunzip)
						.on('data', (chunk) => {
							jsonDataString += chunk.toString();
							// chunks.push(chunk);
						})
						.on('end', () => {
							console.log('File extracted successfully');
							//  const jsonDataString = Buffer.concat(chunks).toString();
							resolve(dataProcessingFn(jsonDataString));
						})
						.on('error', (err) => {
							console.error('Error decompressing fetched GZ file:', err);
							reject(err);
						});
				},
			)
			.on('error', (err) => {
				console.error('Error fetching data:', err);
				reject(err);
			});
	});
}

/* function fetchAndProcessFile(url, outputPath) {
	try {
		https
			.get(url, (response) => {
				const gunzip = zlib.createGunzip();
				let jsonData = '';

				response
					.pipe(gunzip)
					.on('data', (chunk) => {
						jsonData += chunk.toString();
					})
					.on('end', () => {
						console.log('JSON file extracted successfully.');
						// writeCsv(jsonData, outputCsvPath_BSE);
						// writeGz(jsonToCsv(jsonData), outputPath);
					})
					.on('error', (err) => {
						console.error('Error during decompression:', err);
					});
			})
			.on('error', (err) => {
				console.error('Error fetching the file:', err);
			});
	} catch (err) {
		console.error('ERROR fetching and processing of ' + url + ' :', err);
	}
} */

/** Transpiles JSON properties from NSE.json to CSV columns for NSE, NFO and CDS tables
 * Writes compressed GZIP file to output directory
 * @param {string} jsonDataStr JSON data string
 */
function nseJson_to_nseNfoCds_csv(jsonDataStr) {
	if (!jsonDataStr) return null;
	try {
		const instrumentsDataAry = JSON.parse(jsonDataStr);
		if (instrumentsDataAry.length < 1) throw new Error('NSE json array is empty');

		const bufferStream = new Readable({
			read() {
				//emit header-data events
				//We use headers in CSV so that we need not have an empty row due to caveat when using \n escape in for-loop below when adding row
				//To make it efficient, we do not add any condition to check if row being added is first row
				this.emit('NSE', 'pk/token,name,lotsize');
				this.emit('NFO', 'pk/token,name,lotsize');
				this.emit('CDS', 'pk/token,lotsize');
				//emit row-data events
				instrumentsDataAry.forEach((instrument) => {
					// since we write to different CSV files (ie NSE, NFO and CDS) and not just one CSV file, we emit named events and write to relevant file on listening to these emitted events
					if (instrument.segment === 'NSE_EQ') {
						this.emit(
							'NSE',
							`\n${instrument.trading_symbol}/${stripSegFromInstrumentToken(instrument.instrument_key)},${instrument.name},${instrument.lot_size}`,
						); // Emit event for NSE.csv.gz
					} else if (instrument.segment === 'NSE_INDEX') {
						this.emit('NSE', `\n${instrument.trading_symbol}/${stripSegFromInstrumentToken(instrument.instrument_key)},,`); // Emit event for NSE.csv.gz
					} else if (instrument.segment === 'NSE_FO') {
						if (instrument.instrument_type === 'CE') {
							this.emit(
								'NFO',
								`\n${instrument.underlying_symbol}|C|${_convertTo_stdPk_dateFormat(new Date(instrument.expiry))}|${instrument.strike_price}/${stripSegFromInstrumentToken(instrument.instrument_key)},${instrument.underlying_type === 'EQUITY' ? instrument.name : ''},${instrument.lot_size}`,
							); // Emit event for NFO.csv.gz
						} else if (instrument.instrument_type === 'PE') {
							this.emit(
								'NFO',
								`\n${instrument.underlying_symbol}|P|${_convertTo_stdPk_dateFormat(new Date(instrument.expiry))}|${instrument.strike_price}/${stripSegFromInstrumentToken(instrument.instrument_key)},${instrument.underlying_type === 'EQUITY' ? instrument.name : ''},${instrument.lot_size}`,
							); // Emit event for NFO.csv.gz
						} else if (instrument.instrument_type === 'FUT') {
							this.emit(
								'NFO',
								`\n${instrument.underlying_symbol}|F|${_convertTo_stdPk_dateFormat(new Date(instrument.expiry))}|/${stripSegFromInstrumentToken(instrument.instrument_key)},${instrument.underlying_type === 'EQUITY' ? instrument.name : ''},${instrument.lot_size}`,
							); // Emit event for NFO.csv.gz
						}
					} else if (instrument.segment === 'NCD_FO') {
						if (instrument.instrument_type === 'CE') {
							this.emit(
								'CDS',
								`\n${instrument.underlying_symbol}|C|${_convertTo_stdPk_dateFormat(new Date(instrument.expiry))}|${instrument.strike_price}/${stripSegFromInstrumentToken(instrument.instrument_key)},${instrument.lot_size}`,
							); // Emit event for CDS.csv.gz
						} else if (instrument.instrument_type === 'PE') {
							this.emit(
								'CDS',
								`\n${instrument.underlying_symbol}|P|${_convertTo_stdPk_dateFormat(new Date(instrument.expiry))}|${instrument.strike_price}/${stripSegFromInstrumentToken(instrument.instrument_key)},${instrument.lot_size}`,
							); // Emit event for CDS.csv.gz
						} else if (instrument.instrument_type === 'FUT') {
							this.emit(
								'CDS',
								`\n${instrument.underlying_symbol}|F|${_convertTo_stdPk_dateFormat(new Date(instrument.expiry))}|/${stripSegFromInstrumentToken(instrument.instrument_key)},${instrument.lot_size}`,
							); // Emit event for CDS.csv.gz
						}
					}
				});
				this.push(null); // Signal the end of the stream
			},
		});
		const NSE_outputPath = path.resolve(__dirname, '../../public/upstox/NSE.csv.gz'),
			NFO_outputPath = path.resolve(__dirname, '../../public/upstox/NFO.csv.gz'),
			CDS_outputPath = path.resolve(__dirname, '../../public/upstox/CDS.csv.gz');

		const NSE_gzip = zlib.createGzip(),
			NFO_gzip = zlib.createGzip(),
			CDS_gzip = zlib.createGzip();
		const NSE_writeStream = fs.createWriteStream(NSE_outputPath),
			NFO_writeStream = fs.createWriteStream(NFO_outputPath),
			CDS_writeStream = fs.createWriteStream(CDS_outputPath);

		NSE_writeStream.on('finish', () => console.log('NSE file created successfully at:', NSE_outputPath));
		NFO_writeStream.on('finish', () => console.log('NFO file created successfully at:', NFO_outputPath));
		CDS_writeStream.on('finish', () => console.log('CDS file created successfully at:', CDS_outputPath));

		NSE_writeStream.on('error', (error) => console.error('Error writing GZ file:', error));
		NFO_writeStream.on('error', (error) => console.error('Error writing GZ file:', error));
		CDS_writeStream.on('error', (error) => console.error('Error writing GZ file:', error));

		//watch for data stream read emitted events and write to relevant file streams
		bufferStream.on('NSE', (chunk) => NSE_gzip.write(chunk));
		bufferStream.on('NFO', (chunk) => NFO_gzip.write(chunk));
		bufferStream.on('CDS', (chunk) => CDS_gzip.write(chunk));

		bufferStream.on('end', () => {
			NSE_gzip.end();
			NFO_gzip.end();
			CDS_gzip.end();
		});

		bufferStream.pipe(NSE_gzip).pipe(NSE_writeStream);
		bufferStream.pipe(NFO_gzip).pipe(NFO_writeStream);
		bufferStream.pipe(CDS_gzip).pipe(CDS_writeStream);
	} catch (err) {
		console.error('ERROR transpiling JSON to CSV:', err);
		return null;
	}
}

/** Transpiles JSON properties from BSE.json to CSV columns
 * Writes compressed GZIP file to output directory
 * @param {string} jsonDataStr JSON data string
 */
function bseJson_to_csv(jsonDataStr) {
	try {
		const instrumentsDataAry = JSON.parse(jsonDataStr);
		if (instrumentsDataAry.length < 1) throw new Error('BSE json array is empty');

		const bufferStream = new Readable({
			read() {
				//emit header-data events
				//We use headers in CSV so that we need not have an empty row due to caveat when using \n escape in for-loop below when adding row
				//To make it efficient, we do not add any condition to check if row being added is first row
				this.push('pk/token,name,lotsize');

				//push row-data
				instrumentsDataAry.forEach((instrument) => {
					if (instrument.segment === 'BSE_EQ') {
						this.push(
							`\n${instrument.trading_symbol}/${stripSegFromInstrumentToken(instrument.instrument_key)},${instrument.name},${instrument.lot_size}`,
						);
					} else if (instrument.segment === 'BSE_INDEX') {
						this.push(`\n${instrument.trading_symbol}/${stripSegFromInstrumentToken(instrument.instrument_key)},,`); // Emit event for NSE.csv.gz
					}
				});
				this.push(null); // Signal the end of the stream
			},
		});

		const gzip = zlib.createGzip();
		const writeStream = fs.createWriteStream(path.resolve(__dirname, '../../public/upstox/BSE.csv.gz'));

		writeStream.on('finish', () => {
			console.log('BSE.csv.gz file created successfully');
		});

		writeStream.on('error', (error) => {
			console.error('Error writing BSE.csv.gz file:', error);
		});
		bufferStream.on('end', () => {
			gzip.end();
		});
		bufferStream.pipe(gzip).pipe(writeStream);
	} catch (err) {
		console.error('ERROR transpiling JSON to CSV:', err);
		return null;
	}
}

/** Transpiles JSON properties from MCX.json to CSV columns
 * Writes compressed GZIP file to output directory
 * @param {string} jsonDataStr JSON data string
 */
function mcxJson_to_csv(jsonDataStr) {
	try {
		const instrumentsDataAry = JSON.parse(jsonDataStr);
		if (instrumentsDataAry.length < 1) throw new Error('MCX json array is empty');

		const bufferStream = new Readable({
			read() {
				//emit header-data events
				//We use headers in CSV so that we need not have an empty row due to caveat when using \n escape in for-loop below when adding row
				//To make it efficient, we do not add any condition to check if row being added is first row
				this.push('pk/token,lotsize');

				//push row-data
				instrumentsDataAry.forEach((instrument) => {
					if (instrument.segment === 'MCX_FO') {
						// this.push(
						// 	`\n${instrument.trading_symbol}/${stripSegFromInstrumentToken(instrument.instrument_key)},${instrument.name},${instrument.lot_size}`,
						// );
						if (instrument.instrument_type === 'CE') {
							this.push(
								`\n${instrument.underlying_symbol}|C|${_convertTo_stdPk_dateFormat(new Date(instrument.expiry))}|${instrument.strike_price}/${stripSegFromInstrumentToken(instrument.instrument_key)},${instrument.lot_size}`,
							);
						} else if (instrument.instrument_type === 'PE') {
							this.push(
								`\n${instrument.underlying_symbol}|P|${_convertTo_stdPk_dateFormat(new Date(instrument.expiry))}|${instrument.strike_price}/${stripSegFromInstrumentToken(instrument.instrument_key)},${instrument.lot_size}`,
							);
						} else if (instrument.instrument_type === 'FUT') {
							this.push(
								`\n${instrument.underlying_symbol}|F|${_convertTo_stdPk_dateFormat(new Date(instrument.expiry))}|/${stripSegFromInstrumentToken(instrument.instrument_key)},${instrument.lot_size}`,
							);
						}
					}
				});
				this.push(null); // Signal the end of the stream
			},
		});

		const gzip = zlib.createGzip();
		const writeStream = fs.createWriteStream(path.resolve(__dirname, '../../public/upstox/MCX.csv.gz'));

		writeStream.on('finish', () => {
			console.log('MCX.csv.gz file created successfully');
		});

		writeStream.on('error', (error) => {
			console.error('Error writing MCX.csv.gz file:', error);
		});
		bufferStream.on('end', () => {
			gzip.end();
		});
		bufferStream.pipe(gzip).pipe(writeStream);
	} catch (err) {
		console.error('ERROR transpiling JSON to CSV:', err);
		return null;
	}
}

/**
 * Transpiles JSON properties to CSV columns
 * @param {string} jsonData - JSON data string
 * @returns {?string} CSV string
 */
/*function jsonToCsv(jsonData) {
	if (!jsonData) return null;
	try {
		const jsonArray = JSON.parse(jsonData);
		if (jsonArray.length < 1) throw new Error('JSON array is empty');

		// // read the first object in the array to check if it has the properties we intend to write to CSV columns
		// const firstItem = jsonArray[0];
		// const requiredProperties = ['instrument_key', 'trading_symbol', 'name', 'lot_size', 'instrument_type'];
		// const hasAllProperties = requiredProperties.every((prop) => prop in firstItem);
		// if (!hasAllProperties) throw new Error('First object in JSON array is missing required properties');

		// const csvHeader = 'instrument_key,trading_symbol,name,expiry,lot_size,instrument_type\n';
		const csvRows = jsonArray
			// .filter((item) => ['EQ', 'BE', 'CE', 'PE', 'FUT', 'B', 'X', 'XT'].includes(item.instrument_type))	//only include these types
			// .filter((item) => !['F','G','SG','N0','ZQ','AA','AB','AL','AZ','BW','GS','N0','N1','N2','N3','N4','N5','NX','NC','NR','NT','SG','TB','YJ','Y3','YR','YW','YY','Z4','Z8','ZL','ZT','ZQ'].includes(item.instrument_type)) //ignore these types which have symbols with arbitrary name-number combo
			//IGNORE SYMBOLS STARTING WITH 0 OR STARTING AND ENDING WITH A NUMBER
			// .filter((item.trading_symbol) => {
			// 	const startsWithZero = item.trading_symbol.startsWith('0');
			// 	const startsAndEndsWithNumber = /^\d.*\d$/.test(item.trading_symbol);
			// 	return !startsWithZero && !startsAndEndsWithNumber;
			// })
			// .filter(({ trading_symbol }) => !trading_symbol.startsWith('0') && !/^\d.*\d$/.test(trading_symbol)) //same as above but shortened
			.filter(
				({ trading_symbol, instrument_type }) =>
					!trading_symbol.startsWith('0') && !/^\d.*\d$/.test(trading_symbol) && !['F', 'G'].includes(instrument_type),
			)
			.map((item) => `${item.instrument_key},${item.trading_symbol},${item.name},${item.expiry || ''},${item.lot_size},${item.instrument_type}`)
			.join('\n');

		// const csvData = csvHeader + csvRows;
		// return csvHeader + csvRows;
		return csvRows;
	} catch (err) {
		console.error('ERROR transpiling JSON to CSV:', err);
		return null;
	}
} */

//more efficient because it uses synchronous methods (gzipSync and writeFileSync), which can be faster for smaller datasets.
//However, this approach blocks the event loop, which may not be ideal for larger datasets or in a high-concurrency environment.
/* function writeGz(jsonData, outputPath) {
	try {
		const jsonArray = JSON.parse(jsonData);
		const csvHeader = 'instrument_key,trading_symbol,name,lot_size,instrument_type\n';
		const csvRows = jsonArray
			.map((item) => {
				return `${item.instrument_key},${item.trading_symbol},${item.name},${item.lot_size},${item.instrument_type}`;
			})
			.join('\n');

		const csvData = csvHeader + csvRows;
		const buffer = Buffer.from(csvData, 'utf-8');
		const compressedData = zlib.gzipSync(buffer);
		fs.writeFileSync(outputPath, compressedData);
	} catch (error) {
		console.error('Error writing GZ file:', error);
	}
} */

//more scalable than above version due to its use of streams.
//This allows it to handle larger datasets without consuming excessive memory or blocking the event loop, as it processes data in chunks.
// /**
//  * Takes in the CSV text data and outputs gzipped CSV
//  * @param {string} csvText - Text to be compressed
//  * @param {string} outputPath - Output path including the file name and extension
//  */
/* function writeGz(csvText, outputPath) {
	try {
		const bufferStream = new Readable({
			read() {
				this.push(csvText);
				this.push(null); // Signal the end of the stream
			},
		});

		const gzip = zlib.createGzip();
		const writeStream = fs.createWriteStream(outputPath);

		writeStream.on('finish', () => {
			console.log('GZ file created successfully at:', outputPath);
		});

		writeStream.on('error', (error) => {
			console.error('Error writing GZ file:', error);
		});

		bufferStream.pipe(gzip).pipe(writeStream);
	} catch (error) {
		console.error('Error writing GZIP file:', error);
	}
} */

/** Converts date-string to a standardized format (yyyy-mm-dd) used in cross-broker std primary-key
 * @param {Date} date
 * @returns {string}
 */
function _convertTo_stdPk_dateFormat(date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}
///
/** Strips segment part from token.
 * For eg. returns '123456' part from 'NSE_EQ|123456'
 * We re-build the entire token by prepending the segment in our frontend code
 */
function stripSegFromInstrumentToken(token) {
	// return token.split('|')[1];
	return token.substring(token.indexOf('|') + 1); //more efficient
}
