const { sendData} = require('../odoo/sendData');

async function checkDataAndSend(username, password, modelName, activityData) {
  if (activityData.presence.timestamp && activityData.screenshot) {
    try {
      await sendData(
        username,
        password,
        modelName,
        {
          timestamp: activityData.presence.timestamp,
          presence_status: activityData.presence.status,
          screenshot: activityData.screenshot.path,
        }
      );
      activityData.presence = null;
      activityData.screenshot = null;
    } catch (error) {
      console.error('Error al enviar datos combinados a Odoo:', error);
    }
  }
}

module.exports = { checkDataAndSend }