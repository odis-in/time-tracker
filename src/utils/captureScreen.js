const screenshot = require('screenshot-desktop');
const { Buffer } = require('buffer');
const { systemPreferences } = require('electron');
const { systemLogger } = require('./systemLogs');
const logger = systemLogger();

function getScreenCapturePermissionStatus() {
    if (process.platform !== 'darwin') {
        return 'granted';
    }

    if (!systemPreferences || typeof systemPreferences.getMediaAccessStatus !== 'function') {
        return 'unknown';
    }

    try {
        return systemPreferences.getMediaAccessStatus('screen');
    } catch (err) {
        logger.warn(`No se pudo consultar permiso de Screen Recording: ${err.message}`);
        return 'unknown';
    }
}

async function captureScreen(activityData) {
    try {        
        const permissionStatus = getScreenCapturePermissionStatus();
        if (process.platform === 'darwin' && permissionStatus !== 'granted' && permissionStatus !== 'unknown') {
            logger.warn(`Permiso de Screen Recording no concedido (estado: ${permissionStatus})`);
            return null;
        }

        const img = await screenshot({ format: 'png' });

        const base64Data = Buffer.from(img).toString('base64');
        
        activityData.screenshot = { path: base64Data };
        logger.info('Captura de pantalla realizada con éxito');
        
        return base64Data;
    } catch (err) {
        logger.error(`Error al capturar la pantalla: ${err.message}`);
        return null;
    }
}

module.exports = { captureScreen, getScreenCapturePermissionStatus };
