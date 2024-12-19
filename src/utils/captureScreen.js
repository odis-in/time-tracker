const fs = require('fs');
const path = require('path');
const screenshot = require('desktop-screenshot');
const { Buffer } = require('buffer');
// const { checkDataAndSend } = require('./checkDataAndSend');

function captureScreen(activityData) {
	const desktopPath = path.join(require('os').homedir(), 'Desktop', 'capturas');

	if (!fs.existsSync(desktopPath)) {
		fs.mkdirSync(desktopPath, { recursive: true });
	}

	const filePath = path.join(desktopPath, `screenshot_${Date.now()}.png`);

	screenshot(filePath, (err) => {
		if (err) {
			console.error('Error al capturar la pantalla:', err);
			return;
		}

		fs.readFile(filePath, (readErr, data) => {
			if (readErr) {
				console.error('Error al leer el archivo:', readErr);
				return;
			}
			//convertir base64 
			const base64Data = Buffer.from(data).toString('base64');
			activityData.screenshot = { path: base64Data };
			console.log('Captura de pantalla en base64 lista para enviar a odoo');
		})

		// setTimeout(() => checkDataAndSend(activityData), 1000);
	});
}

module.exports = { captureScreen };