const { getSendScreenshot } = require('../odoo/getSendScreenshot');
const { captureScreen } = require('./captureScreen');
const { handleData } = require('./dataManager');

async function checkDataAndSend(activityData) {
  const send_screenshot = await getSendScreenshot()
  try {
    //Volver a capturar la pantalla si no se ha capturado
    if (activityData.screenshot == null) {
      const result = await captureScreen(activityData);
      activityData.screenshot = { path: result };
    }
    
    if (!activityData.presence || !activityData.screenshot) {
      return { status: 400, message: `${activityData.presence.status}  and ${activityData.screenshot}` };
    }

    const dataToSend = {
      timestamp: activityData.presence.timestamp,
      presence_status: activityData.presence.status,
      screenshot: send_screenshot ? activityData.screenshot.path : null,
      latitude: activityData.latitude,
      longitude: activityData.longitude,
      ip_address: activityData.ipAddress,
      partner_id: activityData.partner_id || null,
      description: activityData.description || null,
      task_id: activityData.task_id || null,
      pause_id : activityData.pause_id || null,
    };
    
    const result = await handleData(dataToSend);
    
    // Limpiar los datos después de enviarlos
    // // // activityData.presence = null;
    activityData.screenshot = null;
    
    
    return result;
    
    // if (activityData.partner_id) {
    //   return { status: 200, message: 'activity data sent' };
    // } else {
    //   return { status: 200, message: 'inactive data sent' };
    // }
  } catch (error) {
    console.error('Error al enviar datos:', error);
    return { status: 500, message: 'Error al enviar datos', error: error.message };
  }
}

module.exports = { checkDataAndSend };