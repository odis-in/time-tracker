const { getSendScreenshot } = require('../odoo/getSendScreenshot');
const { captureScreen, getScreenCapturePermissionStatus } = require('./captureScreen');
const { handleData } = require('./dataManager');
const { autoUpdater } = require('electron-updater');
const { systemLogger } = require('./systemLogs');
const logger = systemLogger();

function tryCheckForUpdates() {
  try {
    logger.info('Comprobando actualizaciones');
    autoUpdater.checkForUpdates();
  } catch (error) {
    console.warn('Error al comprobar actualizaciones:', error);
    logger.info(`Error al comprobar actualizaciones: ${error?.message || error}`);
  }
}

async function checkDataAndSend(activityData) {
  tryCheckForUpdates();
  const send_screenshot = await getSendScreenshot();
  try {
    // Volver a capturar la pantalla si no se ha capturado y el servidor la requiere.
    if (send_screenshot && activityData.screenshot == null) {
      const result = await captureScreen(activityData);
      if (result) {
        activityData.screenshot = { path: result };
      }
    }
    
    if (!activityData.presence) {
      return { status: 400, message: 'No hay estado de presencia para enviar' };
    }

    if (send_screenshot && (!activityData.screenshot || !activityData.screenshot.path)) {
      const permissionStatus = getScreenCapturePermissionStatus();
      const isMacPermissionIssue =
        process.platform === 'darwin' && permissionStatus !== 'granted';

      if (isMacPermissionIssue) {
        return {
          status: 403,
          message:
            `Captura bloqueada. Habilita Screen Recording para Time Tracker en ` +
            `System Settings > Privacy & Security > Screen Recording. Estado actual: ${permissionStatus}`,
        };
      }

      return { status: 400, message: 'No se pudo obtener la captura de pantalla requerida' };
    }

    const isInactive = activityData.presence.status === 'inactive';
    const dataToSend = {
      timestamp: activityData.presence.timestamp,
      presence_status: activityData.presence.status,
      screenshot: send_screenshot ? activityData.screenshot?.path || null : null,
      latitude: activityData.latitude,
      longitude: activityData.longitude,
      ip_address: activityData.ipAddress,
      partner_id: activityData.partner_id || null,
      description: activityData.description || null,
      task_id: isInactive ? false : (activityData.task_id || null),
      brand_id: isInactive ? false : (activityData.brand_id || null),
      pause_id: activityData.pause_id || null,
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
