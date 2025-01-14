const screenshot = require('screenshot-desktop')
const { Buffer } = require('buffer');
// const { checkDataAndSend } = require('./checkDataAndSend');

async function captureScreen(activityData) {

	screenshot({ format: 'png' }).then((img) => {

		const base64Data = Buffer.from(img).toString('base64');

		activityData.screenshot = { path: base64Data };

	}).catch((err) => {
		console.error('Error al capturar la pantalla:', err);
	})
}

async function capture() {
    try {
        // Captura la imagen de la pantalla en formato PNG
        const img = await screenshot({ format: 'png' });

        // Convierte la imagen capturada a base64
        const base64Data = Buffer.from(img).toString('base64');

        // Retorna la imagen en base64
        return base64Data;
    } catch (err) {
        console.error('Error al capturar la pantalla:', err);
        throw err; // Lanza el error para que sea manejado por quien llame a la función
    }
}

module.exports = { captureScreen , capture};