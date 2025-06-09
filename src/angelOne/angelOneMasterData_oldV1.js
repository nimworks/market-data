const fs = require('fs');
const zlib = require('zlib');
const https = require('https');
// const http = require('http');	//shall only be used when testing on sample data loaded via http-server on localhost
const path = require('path');
const { Readable } = require('stream');

try {
	// http.get('http://localhost:8080/angelOneMasterData_sample.txt', (response) => {	//shall only be used when testing on sample data loaded via http-server on localhost
	https
		.get('https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json', (response) => {
			// console.log('statusCode:', response.statusCode);
			// console.log('headers:', response.headers);
			let rawData = '';

			response
				.on('data', (chunk) => {
					rawData += chunk.toString(); //we collect and assemble the incoming packets / chunks
				})
				.on('end', () => {
					//once packets / chunks have completed coming in, we parse the assembled data into JSON

					let nseCsvData = '', //format --> primaryKey/token,lotsize,isNotTradeable
						bseCsvData = '',
						nfoCsvData = '', //format --> primaryKey/token,lotsize
						cdsCsvData = '',
						mcxCsvData = '';
					try {
						const masterDataAry = JSON.parse(rawData);
						masterDataAry.forEach(({ token, symbol, name, expiry, lotsize, instrumenttype, exch_seg, strike }) => {
							if (exch_seg === 'NSE') {
								// if (instrumenttype == 'AMXIDX') {
								if (instrumenttype.endsWith('IDX')) {
									// nseTable.put(`${token},,1`, name);
									nseCsvData += `${name}/${token},,1\n`;
								} else if (symbol.endsWith('-EQ')) {
									// nseTable.put(`${token},${lotsize},`, name);
									nseCsvData += `${name}/${token},${lotsize},\n`;
								}
							} else if (exch_seg === 'BSE') {
								// if (instrumenttype.endsWith('IDX')) {
								if (instrumenttype === 'AMXIDX') {
									// nseTable.put(`${token},,1`, name);
									bseCsvData += `${name}/${token},,1\n`;
								} else {
									//instrumenttype === ''
									// bseTable.put(`${token},${lotsize},`, name);
									bseCsvData += `${name}/${token},${lotsize},\n`;
								}
							} else if (exch_seg === 'NFO') {
								// if (instrumenttype == 'OPTSTK' || instrumenttype == 'OPTIDX') {
								if (instrumenttype.startsWith('OPT')) {
									// nfoTable.put(`${token},${lotsize},${instrumenttype.endsWith('IDX') ? 1 : ''}`, pk);
									// nfoTable.put(
									// 	`${token},${lotsize}`,
									// 	`${name}|${symbol.endsWith('CE') ? 'C' : 'P'}|${_convertTo_stdPk_dateFormat(expiry)}|${strike.toString().replace('00.000000', '')}`, //pk
									// );
									nfoCsvData += `${name}|${symbol.endsWith('CE') ? 'C' : 'P'}|${_convertTo_stdPk_dateFormat(expiry)}|${strike.toString().replace('00.000000', '')}/${token},${lotsize}\n`;
								} else if (instrumenttype.startsWith('FUT')) {
									// if (instrumenttype == 'FUTSTK' || instrumenttype == 'FUTIDX') {
									// nfoTable.put(
									// 	`${token},${lotsize}`,
									// 	`${name}|F|${_convertTo_stdPk_dateFormat(expiry)}|`, //pk
									// );
									nfoCsvData += `${name}|F|${_convertTo_stdPk_dateFormat(expiry)}|/${token},${lotsize}\n`;
								}
							} else if (exch_seg === 'CDS') {
								if (instrumenttype === 'OPTCUR') {
									// cdsTable.put(
									// 	`${token},${lotsize}`,
									// 	`${name}|${symbol.endsWith('CE') ? 'C' : 'P'}|${_convertTo_stdPk_dateFormat(expiry)}|${Number(strike) / 10000000}`, //pk
									// );
									cdsCsvData += `${name}|${symbol.endsWith('CE') ? 'C' : 'P'}|${_convertTo_stdPk_dateFormat(expiry)}|${Number(strike) / 10000000}/${token},${lotsize}\n`;
								} else if (instrumenttype === 'FUTCUR') {
									// cdsTable.put(`${token},${lotsize}`, `${name}|F|${_convertTo_stdPk_dateFormat(expiry)}|`);
									cdsCsvData += `${name}|F|${_convertTo_stdPk_dateFormat(expiry)}|/${token},${lotsize}\n`;
								}
							} else if (exch_seg === 'MCX') {
								if (instrumenttype === 'OPTFUT') {
									//else if (exch_seg === 'MCX' && instrumenttype.startsWith('OPT')) {
									// mcxTable.put(
									// 	`${token},${lotsize}`,
									// 	`${name}|${symbol.endsWith('CE') ? 'C' : 'P'}|${_convertTo_stdPk_dateFormat(expiry)}|${strike.toString().replace('00.000000', '')}`, //primary key
									// );
									mcxCsvData += `${name}|${symbol.endsWith('CE') ? 'C' : 'P'}|${_convertTo_stdPk_dateFormat(expiry)}|${strike.toString().replace('00.000000', '')}/${token},${lotsize}\n`;
								} else if (instrumenttype === 'FUTCOM') {
									//else if (exch_seg === 'MCX' && instrumenttype.startsWith('FUT')) {
									// mcxTable.put(`${token},${lotsize}`, `${name}|F|${_convertTo_stdPk_dateFormat(expiry)}|`);
									mcxCsvData += `${name}|F|${_convertTo_stdPk_dateFormat(expiry)}|/${token},${lotsize}\n`;
								}
							} //else if (exch_seg === 'NCDEX'){}
						});

						//write out to file
						writeGz(nseCsvData.trim(), path.resolve(__dirname, '../../public/angelOne/NSE.csv.gz'));
						writeGz(bseCsvData.trim(), path.resolve(__dirname, '../../public/angelOne/BSE.csv.gz'));
						writeGz(nfoCsvData.trim(), path.resolve(__dirname, '../../public/angelOne/NFO.csv.gz'));
						writeGz(cdsCsvData.trim(), path.resolve(__dirname, '../../public/angelOne/CDS.csv.gz'));
						writeGz(mcxCsvData.trim(), path.resolve(__dirname, '../../public/angelOne/MCX.csv.gz'));
					} catch (err) {
						throw new Error('Error parsing JSON: ' + err);
					}
					//writeCsv(jsonData, outputCsvPath_BSE);
					// writeGz(jsonToCsv(jsonData), outputPath);
				})
				.on('error', (err) => {
					console.error('Error during decompression:', err);
				});
		})
		.on('error', (e) => {
			console.error(e);
		});
} catch (err) {
	console.error('ERROR fetching and processing AngelOne master data:', err);
}

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
/** Takes in text data and outputs gzipped file
 * @param {string} data Text data to be compressed
 * @param {string} outputPath Output path including the file name and extension
 */
function writeGz(data, outputPath) {
	try {
		const bufferStream = new Readable({
			read() {
				this.push(data);
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
}

function _convertTo_stdPk_dateFormat(inputDateStr) {
	const date = new Date(inputDateStr);
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}
