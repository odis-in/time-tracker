const screenshot = require('screenshot-desktop');
const { Buffer } = require('buffer');

async function captureScreen(activityData) {
    try {        
        const img = await screenshot({ format: 'png' });

        const base64Data = Buffer.from(img).toString('base64');
        
        activityData.screenshot = { path: base64Data };
        
        return base64Data;
    } catch (err) {
        console.error('Error al capturar la pantalla:', err);
    }
}

module.exports = { captureScreen };
