const screenshot = require('screenshot-desktop');
const { Buffer } = require('buffer');
const { systemLogger } = require('./systemLogs');
const logger = systemLogger();
async function captureScreen(activityData) {
    try {        
        const img = await screenshot({ format: 'png' });

        const base64Data = Buffer.from(img).toString('base64');
        
        activityData.screenshot = { path: base64Data };
        logger.info('Captura de pantalla realizada con éxito');
        
        return base64Data;
    } catch (err) {
        logger.error(`Error al capturar la pantalla: ${err.message}`);
    }
}

module.exports = { captureScreen };
