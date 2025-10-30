// src/utils/presenceNotification.js
const { Notification } = require('electron');
const { createModalWindow } = require('./windowaManager');
const { checkDataAndSend } = require('./checkDataAndSend');
const path = require('path');

const NOTIFICATION_TIMEOUT_MS = 15000; // tiempo máximo para que el usuario responda

function getFormattedTimestamp() {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
}

function presenceNotification(activityData = {}) {
  if (!Notification.isSupported()) return;

  let resolved = false;
  let timeoutId = null;

  const resolve = () => {
    if (resolved) return false;
    resolved = true;
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = null;
    return true;
  };

  const notification = new Notification({
    title: 'Confirmar presencia',
    body: 'Haz clic para confirmar tu presencia',
    icon: path.join(__dirname, '../assets/img/timer-ticker-ico.png'),
    silent: false,
    hasReply: false
  });

  const handleTimeout = (reason = 'timeout') => {
    if (!resolve()) return;
    if (reason === 'timeout') {
      notification.close();
    }
    activityData.presence = { status: 'inactive', timestamp: getFormattedTimestamp() };
    checkDataAndSend(activityData);
  };

  notification.on('click', () => {
    if (!resolve()) return;
    createModalWindow();
  });

  notification.on('action', resolve);
  notification.on('reply', resolve);
  notification.on('close', () => handleTimeout('close'));

  notification.show();
  timeoutId = setTimeout(handleTimeout, NOTIFICATION_TIMEOUT_MS);
}


module.exports = { presenceNotification };
