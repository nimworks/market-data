const fs = require('fs');
const zlib = require('zlib');
const https = require('https');
// const http = require('http');	//shall only be used when testing on sample data loaded via http-server on localhost
const path = require('path');
const { Readable } = require('stream');

try {
	https
		.get('https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json', (response) => {
			let rawData = '';

			response
				.on('data', (chunk) => {
					rawData += chunk.toString(); //we collect and assemble the incoming packets / chunks
				})
				.on('end', () => {
					//once packets / chunks have completed coming in, we parse the assembled data into JSON and process it further
					processDataAndWriteFile(rawData);
				})
				.on('error', (err) => {
					console.error('Error fetching:', err);
				});
		})
		.on('error', (err) => {
			console.error('Error fetching data:', err);
		});
} catch (err) {
	console.error('ERROR fetching and processing AngelOne master data:', err);
}

/** Transpiles JSON properties from json master-data to CSV columns for NSE, BSE, NFO, CDS and MCX tables
 * Writes compressed GZIP file to output directory
 * @param {string} rawData JSON data string
 */
function processDataAndWriteFile(rawData) {
	if (!rawData) return null;
	try {
		const instrumentsDataAry = JSON.parse(rawData);
		if (instrumentsDataAry.length < 1) throw new Error('Instruments-data array is empty');

		const bufferStream = new Readable({
			read() {
				//emit header-data events
				//We use headers in CSV so that we need not have an empty row due to caveat when using \n escape in for-loop below when adding row
				//To make it efficient, we do not add any condition to check if row being added is first row
				// since we write to different CSV files (ie NSE, NFO and CDS) and not just one CSV file, we emit named events and write to relevant file on listening to these emitted events
				this.emit('NSE', 'pk/token,lotsize');
				this.emit('BSE', 'pk/token,lotsize');
				this.emit('NFO', 'pk/token,lotsize');
				this.emit('CDS', 'pk/token,lotsize');
				this.emit('MCX', 'pk/token,lotsize');
				//emit row-data events
				instrumentsDataAry.forEach(({ token, symbol, name, expiry, lotsize, instrumenttype, exch_seg, strike }) => {
					if (exch_seg === 'NSE') {
						// if (instrumenttype == 'AMXIDX') {
						if (instrumenttype.endsWith('IDX')) {
							this.emit('NSE', `\n${name}/${token},`);
						} else if (symbol.endsWith('-EQ')) {
							this.emit('NSE', `\n${name}/${token},${lotsize}`);
						}
					} else if (exch_seg === 'BSE') {
						// if (instrumenttype.endsWith('IDX')) {
						if (instrumenttype === 'AMXIDX') {
							this.emit('BSE', `\n${name}/${token},`);
						} else {
							this.emit('BSE', `\n${name}/${token},${lotsize}`);
						}
					} else if (exch_seg === 'NFO') {
						// if (instrumenttype == 'OPTSTK' || instrumenttype == 'OPTIDX') {
						if (instrumenttype.startsWith('OPT')) {
							this.emit(
								'NFO',
								`\n${name}|${symbol.endsWith('CE') ? 'C' : 'P'}|${_convertTo_stdPk_dateFormat(expiry)}|${strike.toString().replace('00.000000', '')}/${token},${lotsize}`,
							);
						} else if (instrumenttype.startsWith('FUT')) {
							this.emit('NFO', `\n${name}|F|${_convertTo_stdPk_dateFormat(expiry)}|/${token},${lotsize}`);
						}
					} else if (exch_seg === 'CDS') {
						if (instrumenttype === 'OPTCUR') {
							this.emit(
								'CDS',
								`\n${name}|${symbol.endsWith('CE') ? 'C' : 'P'}|${_convertTo_stdPk_dateFormat(expiry)}|${Number(strike) / 10000000}/${token},${lotsize}`,
							);
						} else if (instrumenttype === 'FUTCUR') {
							this.emit('CDS', `\n${name}|F|${_convertTo_stdPk_dateFormat(expiry)}|/${token},${lotsize}`);
						}
					} else if (exch_seg === 'MCX') {
						if (instrumenttype === 'OPTFUT') {
							this.emit(
								'MCX',
								`\n${name}|${symbol.endsWith('CE') ? 'C' : 'P'}|${_convertTo_stdPk_dateFormat(expiry)}|${strike.toString().replace('00.000000', '')}/${token},${lotsize}`,
							);
						} else if (instrumenttype === 'FUTCOM') {
							this.emit('MCX', `\n${name}|F|${_convertTo_stdPk_dateFormat(expiry)}|/${token},${lotsize}`);
						}
					} //else if (exch_seg === 'NCDEX'){}
				});
				this.push(null); // Signal the end of the stream
			},
		});
		const NSE_outputPath = path.resolve(__dirname, '../../public/angelOne/NSE.csv.gz'),
			BSE_outputPath = path.resolve(__dirname, '../../public/angelOne/BSE.csv.gz'),
			NFO_outputPath = path.resolve(__dirname, '../../public/angelOne/NFO.csv.gz'),
			CDS_outputPath = path.resolve(__dirname, '../../public/angelOne/CDS.csv.gz'),
			MCX_outputPath = path.resolve(__dirname, '../../public/angelOne/MCX.csv.gz');

		const NSE_gzip = zlib.createGzip(),
			BSE_gzip = zlib.createGzip(),
			NFO_gzip = zlib.createGzip(),
			CDS_gzip = zlib.createGzip(),
			MCX_gzip = zlib.createGzip();
		const NSE_writeStream = fs.createWriteStream(NSE_outputPath),
			BSE_writeStream = fs.createWriteStream(BSE_outputPath),
			NFO_writeStream = fs.createWriteStream(NFO_outputPath),
			CDS_writeStream = fs.createWriteStream(CDS_outputPath),
			MCX_writeStream = fs.createWriteStream(MCX_outputPath);

		NSE_writeStream.on('finish', () => console.log('NSE file created successfully at:', NSE_outputPath));
		BSE_writeStream.on('finish', () => console.log('BSE file created successfully at:', BSE_outputPath));
		NFO_writeStream.on('finish', () => console.log('NFO file created successfully at:', NFO_outputPath));
		CDS_writeStream.on('finish', () => console.log('CDS file created successfully at:', CDS_outputPath));
		MCX_writeStream.on('finish', () => console.log('MCX file created successfully at:', MCX_outputPath));

		NSE_writeStream.on('error', (error) => console.error('Error writing GZ file:', error));
		BSE_writeStream.on('error', (error) => console.error('Error writing GZ file:', error));
		NFO_writeStream.on('error', (error) => console.error('Error writing GZ file:', error));
		CDS_writeStream.on('error', (error) => console.error('Error writing GZ file:', error));
		MCX_writeStream.on('error', (error) => console.error('Error writing GZ file:', error));

		//watch for data stream read emitted events and write to relevant file streams
		bufferStream.on('NSE', (chunk) => NSE_gzip.write(chunk));
		bufferStream.on('BSE', (chunk) => BSE_gzip.write(chunk));
		bufferStream.on('NFO', (chunk) => NFO_gzip.write(chunk));
		bufferStream.on('CDS', (chunk) => CDS_gzip.write(chunk));
		bufferStream.on('MCX', (chunk) => MCX_gzip.write(chunk));

		bufferStream.on('end', () => {
			NSE_gzip.end();
			BSE_gzip.end();
			NFO_gzip.end();
			CDS_gzip.end();
			MCX_gzip.end();
		});

		bufferStream.pipe(NSE_gzip).pipe(NSE_writeStream);
		bufferStream.pipe(BSE_gzip).pipe(BSE_writeStream);
		bufferStream.pipe(NFO_gzip).pipe(NFO_writeStream);
		bufferStream.pipe(CDS_gzip).pipe(CDS_writeStream);
		bufferStream.pipe(MCX_gzip).pipe(MCX_writeStream);
	} catch (err) {
		console.error('ERROR transpiling JSON to CSV:', err);
		return null;
	}
}

function _convertTo_stdPk_dateFormat(inputDateStr) {
	const date = new Date(inputDateStr);
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}
