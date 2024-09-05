const { handleData } = require('./dataManager');

async function checkDataAndSend(activityData) {

  if (activityData.presence && activityData.screenshot) {
    const dataToSend = {
      timestamp: activityData.presence.timestamp,
      presence_status: activityData.presence.status,
      screenshot: activityData.screenshot.path,
      latitude: activityData.latitude,
      longitude: activityData.longitude,
      ip_address: activityData.ipAddress
    };

    await handleData(dataToSend);
    activityData.presence = null;
    activityData.screenshot = null;
  }
}

module.exports = { checkDataAndSend };
