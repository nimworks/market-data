const fs = require('fs');
const zlib = require('zlib');
const https = require('https');
const path = require('path');
const { Readable } = require('stream');

// const zipUrl_BSE = 'https://assets.upstox.com/market-quote/instruments/exchange/BSE.json.gz';
// // const outputCsvPath_BSE = path.resolve(__dirname, '../public/upstox/BSE.csv');
// const outputGzPath_BSE = path.resolve(__dirname, '../public/upstox/BSE.csv.gz');

fetchAndProcessFile('https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz', path.resolve(__dirname, '../public/upstox/NSE.csv.gz'));
fetchAndProcessFile('https://assets.upstox.com/market-quote/instruments/exchange/BSE.json.gz', path.resolve(__dirname, '../public/upstox/BSE.csv.gz'));
fetchAndProcessFile('https://assets.upstox.com/market-quote/instruments/exchange/MCX.json.gz', path.resolve(__dirname, '../public/upstox/MCX.csv.gz'));

function fetchAndProcessFile(url, outputPath) {
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
						writeGz(jsonToCsv(jsonData), outputPath);
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
}

/* function writeCsv(jsonData, outputPath) {
	try {
		const jsonArray = JSON.parse(jsonData);
		// const csvHeader = 'segment,name,exchange,isin,instrument_type,instrument_key,lot_size,freeze_quantity,exchange_token,tick_size,trading_symbol\n';
		// const csvRows = jsonArray
		// 	.map((item) => {
		// 		return `${item.segment},${item.name},${item.exchange},${item.isin},${item.instrument_type},${item.instrument_key},${item.lot_size},${item.freeze_quantity},${item.exchange_token},${item.tick_size},${item.trading_symbol}`;
		// 	})
		// 	.join('\n');
		const csvHeader = 'instrument_key,trading_symbol,name,lot_size,instrument_type\n'; //only the data needed by Kaagzi
		const csvRows = jsonArray
			.map((item) => {
				return `${item.instrument_key},${item.trading_symbol},${item.name},${item.lot_size},${item.instrument_type}`;
			})
			.join('\n');

		const csvData = csvHeader + csvRows;
		fs.writeFileSync(outputPath, csvData);
		console.log('CSV file created successfully at:', outputPath);
	} catch (error) {
		console.error('Error writing CSV file:', error);
	}
} */

/**
 * Transpiles JSON properties to CSV columns
 * @param {string} jsonData - JSON data string
 * @returns {?string} CSV string
 */
function jsonToCsv(jsonData) {
	if (!jsonData) return null;
	try {
		const jsonArray = JSON.parse(jsonData);
		if (jsonArray.length < 1) throw new Error('JSON array is empty');

		// read the first object in the array to check if it has the properties we intend to write to CSV columns
		const firstItem = jsonArray[0];
		const requiredProperties = ['instrument_key', 'trading_symbol', 'name', 'lot_size', 'instrument_type'];

		const hasAllProperties = requiredProperties.every((prop) => prop in firstItem);
		if (!hasAllProperties) {
			throw new Error('First object in JSON array is missing required properties');
		}

		const csvHeader = 'instrument_key,trading_symbol,name,expiry,lot_size,instrument_type\n';
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
		return csvHeader + csvRows;
	} catch (err) {
		console.error('ERROR transpiling JSON to CSV:', err);
		return null;
	}
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
/**
 * Takes in the CSV text data and outputs gzipped CSV
 * @param {string} csvText - Text to be compressed
 * @param {string} outputPath - Output path including the file name and extension
 */
function writeGz(csvText, outputPath) {
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
}
