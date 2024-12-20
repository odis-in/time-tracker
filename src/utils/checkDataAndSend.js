const { handleData } = require('./dataManager');

async function checkDataAndSend(activityData) {
  // console.log('prueba desde checkDataAndSend -------------------------->',activityData);
  if (activityData.presence && activityData.screenshot && activityData.partner_id) {
    const dataToSend = {
      timestamp: activityData.presence.timestamp,
      presence_status: activityData.presence.status,
      screenshot: activityData.screenshot.path,
      latitude: activityData.latitude,
      longitude: activityData.longitude,
      ip_address: activityData.ipAddress,
      partner_id: activityData.partner_id,
      description: activityData.description  
    };

    await handleData(dataToSend);
    activityData.presence = null;
    activityData.screenshot = null;
  } else {
    // console.log('prueba desde checkDataAndSend False-------------------------->',activityData);
    const dataToSend = {
      timestamp: activityData.presence.timestamp,
      presence_status: activityData.presence.status,
      screenshot: activityData.screenshot.path,
      latitude: activityData.latitude,
      longitude: activityData.longitude,
      ip_address: activityData.ipAddress,
      partner_id: null,
      description: null  
    };

    await handleData(dataToSend);
    activityData.presence = null;
    activityData.screenshot = null;
  }
}

module.exports = { checkDataAndSend };
