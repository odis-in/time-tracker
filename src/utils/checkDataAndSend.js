const { handleData } = require('./dataManager');

async function checkDataAndSend(activityData) {
  
  try {
    console.time('checkDataAndSend');
    if (!activityData.presence || !activityData.screenshot) {
      return { status: 400, message: `${activityData.presence.status}  and ${activityData.screenshot}` };
    }

    const dataToSend = {
      timestamp: activityData.presence.timestamp,
      presence_status: activityData.presence.status,
      screenshot: activityData.screenshot.path,
      latitude: activityData.latitude,
      longitude: activityData.longitude,
      ip_address: activityData.ipAddress,
      partner_id: activityData.partner_id || null,
      description: activityData.description || null
    };
    console.time('--------------------- HANDLE DATA SENT------------------------')
    const result = await handleData(dataToSend);
    console.timeEnd('--------------------- HANDLE DATA SENT------------------------')
    // Limpiar los datos después de enviarlos
    activityData.presence = null;
    activityData.screenshot = null;
    console.timeEnd('checkDataAndSend');
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