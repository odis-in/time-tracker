const { getSendScreenshot } = require('../odoo/getSendScreenshot');
const { captureScreen, getScreenCapturePermissionStatus } = require('./captureScreen');
const { handleData } = require('./dataManager');
const { autoUpdater } = require('electron-updater');
const { systemLogger } = require('./systemLogs');
const logger = systemLogger();

function toActivityDate(rawValue) {
  if (!rawValue) return null;
  let normalized = String(rawValue).trim();
  if (normalized.includes(' ') && !normalized.includes('T')) {
    normalized = normalized.replace(' ', 'T');
  }
  if (!/[zZ]$|[+\-]\d{2}:\d{2}$/.test(normalized)) {
    normalized = `${normalized}Z`;
  }
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatActivityDate(date) {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

function buildPreviousHourTimestamps(regPrevHour) {
  const startDate = toActivityDate(regPrevHour?.timeStart);
  const endDate = toActivityDate(regPrevHour?.timeEnd);

  if (!startDate || !endDate || endDate <= startDate) {
    return regPrevHour?.timeStart ? [regPrevHour.timeStart] : [];
  }

  const intervalMinutes = Number(regPrevHour?.timeNotification);
  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
    return [formatActivityDate(startDate), formatActivityDate(endDate)];
  }

  const timestamps = [formatActivityDate(startDate)];
  let cursor = startDate.getTime();
  const intervalMs = intervalMinutes * 60 * 1000;

  while (cursor + intervalMs < endDate.getTime()) {
    cursor += intervalMs;
    timestamps.push(formatActivityDate(new Date(cursor)));
  }

  const formattedEnd = formatActivityDate(endDate);
  if (timestamps[timestamps.length - 1] !== formattedEnd) {
    timestamps.push(formattedEnd);
  }

  return timestamps;
}

function buildActivityEntries(activityData, regPrevHour = false, options = {}) {
  const { includeScreenshot = true } = options;
  const isInactive = activityData.presence.status === 'inactive';
  const baseEntry = {
    presence_status: activityData.presence.status,
    screenshot: includeScreenshot ? activityData.screenshot?.path || null : null,
    latitude: activityData.latitude,
    longitude: activityData.longitude,
    ip_address: activityData.ipAddress,
    partner_id: activityData.partner_id || null,
    description: activityData.description || null,
    task_id: isInactive ? false : (activityData.task_id || null),
    brand_id: isInactive ? false : (activityData.brand_id || null),
    pause_id: activityData.pause_id || null,
  };

  const timestamps = regPrevHour
    ? buildPreviousHourTimestamps(regPrevHour)
    : [activityData.presence.timestamp];

  return timestamps.map((timestamp) => ({
    ...baseEntry,
    timestamp,
  }));
}

function tryCheckForUpdates() {
  try {
    logger.info('Comprobando actualizaciones');
    autoUpdater.checkForUpdates();
  } catch (error) {
    console.warn('Error al comprobar actualizaciones:', error);
    logger.info(`Error al comprobar actualizaciones: ${error?.message || error}`);
  }
}

async function checkDataAndSend(activityData, regPrevHour = false) {
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

    const dataToSend = buildActivityEntries(activityData, regPrevHour, {
      includeScreenshot: send_screenshot,
    });
    
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

module.exports = { checkDataAndSend, buildActivityEntries };
