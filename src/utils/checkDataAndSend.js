const { handleData } = require('./dataManager');

async function checkDataAndSend(activityData) {

  if (activityData.presence && activityData.screenshot) {
    const dataToSend = {
      timestamp: activityData.presence.timestamp,
      presence_status: activityData.presence.status,
      screenshot: activityData.screenshot.path,
    };

    await handleData(dataToSend); // Usar handleData en lugar de sendData directamente
    // Reiniciar el estado después de procesar los datos
    activityData.presence = null;
    activityData.screenshot = null;
  }
}

module.exports = { checkDataAndSend };
