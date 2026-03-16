const { app, Tray, Menu, ipcMain, BrowserWindow, net , powerMonitor } = require('electron');

const { autoUpdater, AppUpdater } = require("electron-updater");
const { authenticateUser } = require('./src/odoo/authenticateUser');
const { getClients } = require('./src/odoo/getClients');
const { getConfig } = require('./src/odoo/getConfig');
const { presenceNotification } = require('./src/utils/presenceNotification');
const cron = require('node-cron');
const path = require('path');
const { captureScreen } = require('./src/utils/captureScreen');
const { saveCredentials, getCredentials, clearCredentials } = require('./src/utils/crendentialManager');
const { createLoginWindow, createMainWindow, createModalWindow, getLoginWindow, getMainWindow, getModalWindow } = require('./src/utils/windowaManager');
const { getIpAndLocation } = require('./src/utils/getIPAddress');
const { checkDataAndSend, buildActivityEntries } = require('./src/utils/checkDataAndSend');
const { calculateTimeDifference, convertDate } = require('./src/utils/calculateTimeDifference');
const { sendActivityUserSummary, sendLocalData, saveDataLocally } = require('./src/utils/dataManager');
const nodeNotifier = require('node-notifier');
const { checkServerConnection } = require('./src/utils/checkConnection');
const { getUserActivity } = require('./src/odoo/getUserActivity');
const { sendDataSummary } = require('./src/odoo/sendData');
// const { getDataPause } = require('./src/odoo/getDataPuase');
const { systemLogger } = require('./src/utils/systemLogs');
const logger = systemLogger();
async function getStore() {
  const { default: Store } = await import('electron-store');
  return new Store();
}
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = app.getVersion().includes('-');

function broadcastUpdateStatus(payload) {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach(win => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('update-status', payload);
    }
  });
}
let tray;
let presenceJob = null;
let screenshotJob = null;
let addressJob = null;
let session = null;
let initialTimeout = null; 
let statusConnection = false;
let currentNotificationMinutes = null;
let pauseAutoResumeTimeout = null;
let pauseAutoResumeMinutes = null;
let isPaused = false;

const activityData = {
  odoo_id: null,
  presence: null,
  screenshot: null,
  latitude: null,
  longitude: null,
  ipAddress: null,
  partner_id: null,
  description: null,
  task_id: null,
  brand_id: null,
  pause_id: null,
};

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {

  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    const mainWindow = getMainWindow();
    const loginWindow = getLoginWindow();

    if (session) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      loginWindow.show();
      loginWindow.focus();
    }
  });

  function createTray() {
    tray = new Tray(path.join(__dirname, './src/assets/img/time-tracker-32x32.png'));
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Mostrar',
        click: () => {
          if (session) {
            createMainWindow();
          } else {
            createLoginWindow();
          }
        }
      },
      {
        label: 'Salir',
        click: () => {
          app.quit();
        }
      }
    ]);

    tray.setToolTip('time-tracker');
    tray.setContextMenu(contextMenu);
  }
  
  function firstNotification() {
    updateActivityPresence();
    const modalWindows = createModalWindow();
    modalWindows.show();
  }
  
  function updateActivityPresence() {
    captureScreen(activityData);
    getIpAndLocation(activityData);
    const timestamp = new Date().toISOString().replace('T',' ').substring(0, 19);
    activityData.presence = { status: 'active', timestamp };
  }
  // async function setupCronJobs() {
    
  //   const { timeNotification } = await getCredentials(['timeNotification']);

  //   if (!timeNotification) {
  //     return;
  //   }

  //   const notifationInterval = parseInt(timeNotification);

  //   presenceJob = cron.schedule(`*/${notifationInterval} * * * *`, () => {
  //     presenceNotification(activityData);
  //   });

  //   screenshotJob = cron.schedule(`*/${notifationInterval} * * * *`, () => {
  //     captureScreen(activityData);
      

  //   });

  //   addressJob = cron.schedule(`*/${notifationInterval} * * * *`, () => {
  //     getIpAndLocation(activityData)
  //   });

  //   if (presenceJob && screenshotJob && addressJob) {
  //     return;
  //   }
  // }

  async function setupCronJobs(intervalMinutes) {
    if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
      return;
    }
    logger.info('Cron Jobs configured');
    const intervalMs = intervalMinutes * 60 * 1000;
    const now = new Date();

    if (initialTimeout) clearTimeout(initialTimeout);

    const nextNotification = new Date(now.getTime() + intervalMs);
    logger.info(`Next notification will be at ${nextNotification.toLocaleString('en-US', { hour12: false })}`);

    initialTimeout = setTimeout(() => {
      presenceNotification(activityData);
      captureScreen(activityData);
      getIpAndLocation(activityData);

      presenceJob = setInterval(() => presenceNotification(activityData), intervalMs);
      screenshotJob = setInterval(() => captureScreen(activityData), intervalMs);
      addressJob = setInterval(() => getIpAndLocation(activityData), intervalMs);
      initialTimeout = null;
    }, intervalMs);
}

function stopCronJobs() {
  if (initialTimeout) {
    clearTimeout(initialTimeout);
    initialTimeout = null;
    logger.info('Cron jobs detenidos');
  }

  if (presenceJob) clearInterval(presenceJob);
  if (screenshotJob) clearInterval(screenshotJob);
  if (addressJob) clearInterval(addressJob);
  presenceJob = screenshotJob = addressJob = null;
}

function clearPauseAutoResume() {
  if (pauseAutoResumeTimeout) {
    clearTimeout(pauseAutoResumeTimeout);
    pauseAutoResumeTimeout = null;
  }
}

function schedulePauseAutoResume() {
  clearPauseAutoResume();
  if (!Number.isFinite(pauseAutoResumeMinutes) || pauseAutoResumeMinutes <= 0) {
    return;
  }

  pauseAutoResumeTimeout = setTimeout(() => {
    pauseAutoResumeTimeout = null;
    logger.info('Auto reanudando por tiempo de pausa');
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('timer-event', 'resume');
    }
    updateActivityPresence();
    presenceNotification(activityData);
    setupCronJobs(currentNotificationMinutes);
  }, pauseAutoResumeMinutes * 60 * 1000);
}

function parseActivityTimestamp(rawValue) {
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

function getTimePart(rawValue) {
  if (!rawValue) return null;
  const textValue = String(rawValue);
  if (textValue.includes(' ')) {
    return textValue.split(' ')[1].substring(0, 8);
  }
  if (textValue.includes('T')) {
    return textValue.split('T')[1].replace('Z', '').substring(0, 8);
  }
  return null;
}

function formatDuration(milliseconds) {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function calculateWorkedTimeFromTimestamps(startTimestamp, endTimestamp) {
  const startDate = parseActivityTimestamp(startTimestamp);
  const endDate = parseActivityTimestamp(endTimestamp);

  if (!startDate || !endDate || endDate <= startDate) {
    return '00:00';
  }

  return formatDuration(endDate - startDate);
}

function buildWorkDayFromOdooData(synchronizeData, uid, clients) {
  const activities = Array.isArray(synchronizeData?.activities) ? synchronizeData.activities : [];
  const rows = [];
  let current = null;

  const updateDescription = (activity, nextActivity) => {
    if (activity.partner_id?.[0] === nextActivity.partner_id?.[0] && activity.brand_id?.[1] === nextActivity.brand_id?.[1] && activity.task_id?.[1] === nextActivity.task_id?.[1]) {
      return nextActivity.description || activity.description;
    } 
    else {
      return activity.description;
    }
  }

  const activitiesSorted = [...activities]
    .filter(activity => activity?.timestamp)
    .sort((a, b) => {
      const aDate = parseActivityTimestamp(a.timestamp);
      const bDate = parseActivityTimestamp(b.timestamp);
      if (!aDate || !bDate) return 0;
      return aDate - bDate;
    });

  activitiesSorted.forEach((activity, index) => {
    const status = String(activity.presence_status || '').toLowerCase();
    const activityTime = parseActivityTimestamp(activity.timestamp);
    const nextActivity = activitiesSorted[index + 1];
    const nextActivityTime = parseActivityTimestamp(nextActivity?.timestamp);
    if (!activityTime) return;

    const clientId = activity.partner_id?.[0] || 0;
    const clientName = activity.partner_id?.[1] || ' ';
    const taskName = activity.task_id ? activity.task_id[1] : ' ';
    const intervalTask = clients.find(rec => rec.id === clientId)?.tasks?.find(t => t.name === taskName)?.time_notification || 40;
    const brandName = activity.brand_id ? activity.brand_id[1] || ' ' : ' ';
    const description = activity.pause_id ? activity.pause_id[1] : (activity.description || ' ');
    const activityTimePart = getTimePart(activity.timestamp);
    if (!activityTimePart) return;
    const activityTimeLocal = convertDate(activityTimePart);

    const isSameGroup = current &&
      current.client.id === clientId &&
      current.brand === brandName &&
      current.task === taskName;

    
    const prevActivity = activitiesSorted[index - 1];
    const prevActivityTime = parseActivityTimestamp(prevActivity?.timestamp);
    
    let keepSameGroupByInactive = false;
    if ( status === 'inactive' && nextActivity?.presence_status === 'active' ) {
      if ( (Math.round(nextActivityTime - prevActivityTime) / 60000) <= intervalTask) {
        keepSameGroupByInactive = true;
      }
    }

    // Crear nuevo registro si no es es del mismo grupo
    if (!isSameGroup && !keepSameGroupByInactive) {
      current = {
        client: { id: clientId, name: clientName },
        date: new Date().toLocaleDateString('en-US'),
        startWork: activityTimeLocal,
        endWork: activityTimeLocal,
        timeWorked: '00:00',
        task: taskName,
        description,
        brand: brandName,
        userId: uid,
        odoo_id: ' ',
        odoo_ids: [activity.id],
        rawStartTimestamp: activity.timestamp,
        rawEndTimestamp: activity.timestamp,
        activeDurationMs: 0,
      };
      rows.push(current);
    }
    
    if (nextActivityTime && nextActivityTime > activityTime) {

      const nextTimePart = getTimePart(nextActivity.timestamp);
      current.activeDurationMs += (nextActivityTime - activityTime);
      current.rawEndTimestamp = nextActivity.timestamp;
      
      if (nextTimePart && intervalTask && Math.round((nextActivityTime - activityTime) / 60000) <= intervalTask + 10) {
        current.endWork = convertDate(nextTimePart);
        current.timeWorked = formatDuration(current.activeDurationMs);
        current.description = updateDescription(activity, nextActivity);

      }
      else if (nextTimePart && intervalTask && Math.round((nextActivityTime - activityTime) / 60000) > intervalTask + 10) {
        current = {
        client: { id: nextActivity.partner_id?.[0] || 0, name: nextActivity.partner_id?.[1] || ' ' },
        date: new Date().toLocaleDateString('en-US'),
        startWork: convertDate(nextTimePart),
        endWork: convertDate(nextTimePart),
        timeWorked: '00:00',
        task: nextActivity.task_id ? nextActivity.task_id[1] : ' ',
        description: nextActivity.description,
        brand: nextActivity.brand_id ? nextActivity.brand_id[1] || ' ' : ' ',
        userId: uid,
        odoo_id: ' ',
        odoo_ids: [activity.id],
        rawStartTimestamp: nextActivity.timestamp,
        rawEndTimestamp: nextActivity.timestamp,
        activeDurationMs: 0,
      };
        rows.push(current);
      }
      else {
        current.timeWorked = "00:00";
        current.endWork = convertDate(activityTimePart);
      }
    }
  });

  return rows.map(row => {
    const { activeDurationMs, ...cleanRow } = row;
    return cleanRow;
  });
}

function updateLocalWorkDay(workDay, { clientData, brandName, taskName, description, uid, timestamp, regPrevHour = false }) {
  if (!clientData || !timestamp) {
    return workDay;
  }

  const nextWorkDay = Array.isArray(workDay) ? [...workDay] : [];

  if (regPrevHour?.timeStart && regPrevHour?.timeEnd) {
    nextWorkDay.push({
      client: clientData,
      brand: brandName,
      date: new Date().toLocaleDateString('en-US'),
      startWork: convertDate(regPrevHour.timeStart.split(' ')[1]),
      endWork: convertDate(regPrevHour.timeEnd.split(' ')[1]),
      timeWorked: calculateWorkedTimeFromTimestamps(regPrevHour.timeStart, regPrevHour.timeEnd),
      task: taskName,
      description,
      userId: uid,
      odoo_id: ' ',
      odoo_ids: [],
      rawStartTimestamp: regPrevHour.timeStart,
      rawEndTimestamp: regPrevHour.timeEnd,
    });

    return nextWorkDay;
  }

  const currentTime = convertDate(timestamp.split(' ')[1]);

  if (nextWorkDay.length === 0) {
    nextWorkDay.push({
      client: clientData,
      brand: brandName,
      date: new Date().toLocaleDateString('en-US'),
      startWork: currentTime,
      endWork: '00:00',
      timeWorked: '00:00',
      task: taskName,
      description,
      userId: uid,
      odoo_id: ' ',
      odoo_ids: [],
      rawStartTimestamp: timestamp,
      rawEndTimestamp: timestamp,
    });

    return nextWorkDay;
  }

  const lastItem = nextWorkDay[nextWorkDay.length - 1];
  const sameGroup =
    lastItem?.client?.id === clientData.id &&
    lastItem?.brand === brandName &&
    lastItem?.task === taskName;

  if (!sameGroup) {
    lastItem.rawEndTimestamp = timestamp;
    lastItem.endWork = currentTime;
    lastItem.timeWorked = calculateWorkedTimeFromTimestamps(lastItem.rawStartTimestamp, lastItem.rawEndTimestamp);

    nextWorkDay.push({
      client: clientData,
      brand: brandName,
      date: new Date().toLocaleDateString('en-US'),
      startWork: currentTime,
      endWork: '00:00',
      timeWorked: '00:00',
      task: taskName,
      description,
      userId: uid,
      odoo_id: ' ',
      odoo_ids: [],
      rawStartTimestamp: timestamp,
      rawEndTimestamp: timestamp,
    });

    return nextWorkDay;
  }

  lastItem.rawEndTimestamp = timestamp;
  lastItem.endWork = currentTime;
  lastItem.timeWorked = calculateWorkedTimeFromTimestamps(lastItem.rawStartTimestamp, lastItem.rawEndTimestamp);
  lastItem.description = description;

  return nextWorkDay;
}

function isConnectionRelatedFailure(result) {
  const details = [result?.message, result?.error]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return [
    'econnrefused',
    'econnreset',
    'enetunreach',
    'enotfound',
    'ehostunreach',
    'etimedout',
    'socket hang up',
    'network',
    'failed to fetch',
    'connection',
    'xml-rpc fault',
    'unknown xml-rpc tag',
    '<title>',
    'title',
    'html',
  ].some(pattern => details.includes(pattern));
}

  async function verifyCredentialsOnStart() {
    try {
      logger.info('verify credentiansl on start');
      const { username, password, url, db , uid, session_id } = await getCredentials(['username', 'password', 'url', 'db', 'uid', 'session_id']);

      if (username && password) {
        logger.info(`Iniciando sesión para el usuario: ${username}`);
        try {
          const[clients, userActivityData, odooConfig , connection] = await Promise.all([
            getClients(session_id, url),
            getUserActivity(),
            getConfig(session_id, url),
            checkServerConnection(),
            // getDataPause()
          ]);
          pausas = odooConfig.user_activity_pause;
          logger.info(`Configuración obtenida: ${JSON.stringify(odooConfig)}`);
          await saveCredentials(username, password, url, odooConfig.time_notification.toString()  , uid, session_id, db);
          session = true;
          
          const store = await getStore();
          store.set(`data-user-${uid}`, userActivityData);
          const synchronizeData = store.get(`data-user-${uid}`) || { summaries: [], activities: [] };
          const data = buildWorkDayFromOdooData(synchronizeData, uid, clients);
          data.sort((a, b) => a.startWork.localeCompare(b.startWork));
          store.set(`work-day-${uid}`, data);
          
          BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('work-day-updated', data);
          });
          
          store.set('clients', clients);
          store.set('odooConfig', odooConfig);
          store.set('pauses', pausas);
        } catch(error) {
          // console.log('Error al iniciar', error);
          logger.error(`Error al iniciar la aplicación: ${error.message}`);
        }
        
        
      
      
      createMainWindow();
      firstNotification();
      setupCronJobs(currentNotificationMinutes);  
        
      } else {
        createLoginWindow();
        session = false;
      }
    } catch (error) {
      console.error('Error al verificar las credenciales:', error);
      createLoginWindow();
    }
  }

  // function stopCronJobs() {
  //   if (presenceJob) {
  //     presenceJob.stop();
  //   }
  //   if (screenshotJob) {
  //     screenshotJob.stop();
  //   }
  // }

  app.whenReady().then(() => {

    powerMonitor.on('suspend', async () => {
      const store = await getStore();
      store.set('suspend', 'suspend');
      sendLastData();
    });
    verifyCredentialsOnStart();
    createTray();
    
    autoUpdater.checkForUpdates();
    ipcMain.handle('login', async (event, username, password, url, db) => {
      try {
        
        const { setCookieHeader, uid, imageBase64 , name } = await authenticateUser(username, password, url, db);
        const [clients ,odooConfig ,store] = await Promise.all([
          getClients(setCookieHeader, url),
          getConfig(setCookieHeader, url),
          getStore()
        ]);

        await saveCredentials(username, password, url, odooConfig.time_notification.toString() , uid.toString(), setCookieHeader.toString(), db);
        // const pauses = await getDataPause()
        const pauses = odooConfig.user_activity_pause;
        const userActivityData = await getUserActivity();
        firstNotification();
        
        store.set(`data-user-${uid}`, userActivityData);
        const synchronizeData = store.get(`data-user-${uid}`) || { summaries: [], activities: [] };
        const data = buildWorkDayFromOdooData(synchronizeData, uid, clients);
        data.sort((a, b) => a.startWork.localeCompare(b.startWork));
        store.set(`work-day-${uid}`, data);

        BrowserWindow.getAllWindows().forEach(win => {
          win.webContents.send('work-day-updated', data);
        });
        
        store.set('clients', clients);
        store.set('odooConfig', odooConfig);
        store.set('pauses', pauses);
        return {uid , name , imageBase64 };
        
      } catch (error) {
        console.error('Error al autenticar con Odoo:', error);
        throw error;
      }
    });
  });
  autoUpdater.on('update-available', () => {
    broadcastUpdateStatus({ state: 'available' });
    if (tray) {
      tray.setToolTip('Actualización disponible. Descargando...');
    }
  });

  autoUpdater.on('update-not-available', () => {
    broadcastUpdateStatus({ state: 'idle' });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const { percent } = progressObj;
    broadcastUpdateStatus({ state: 'downloading', percent });
    if (tray) {
      tray.setToolTip(`Descargando actualización... ${percent.toFixed(2)}%`);
    }
  });

  autoUpdater.on('update-downloaded', () => {
    broadcastUpdateStatus({ state: 'downloaded' });
    setTimeout(() => {
      autoUpdater.quitAndInstall(true, true);
    }, 5000);
  });

  autoUpdater.on('error', (info) => {
    broadcastUpdateStatus({ state: 'error', message: String(info) });
    nodeNotifier.notify({
      title: 'Error en la actualización',
      message: `Error durante la actualización: ${info}`,
      icon: path.join(__dirname, './src/assets/img/timer-ticker-ico.png'),
      sound: true,
      wait: true
    });
  });

  ipcMain.on('minimize-login-window', () => {
    const loginWindow = getLoginWindow();
    if (loginWindow) {
      loginWindow.close();
    }
  });

  ipcMain.on('close-main-window', () => {
    const mainWindow = getMainWindow();
    const loginWindow = getLoginWindow();
    if (mainWindow && session) mainWindow.close();
    if (loginWindow && !session) {
      app.isQuiting = true;
      app.quit();
      tray.destroy();
    }
  });


  async function sendLastData() {
    //obtener datos de la ultima actividad:
    const store = await getStore();
    const { uid } = await getCredentials(['uid']);
    // const work_day = store.get(`work-day-${uid}`) || [];
    // if (work_day.length === 0) {
    //   return;
    // }

    const userActivityData = store.get(`data-user-${uid}`)?.activities

    userActivityData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const lastActivity = userActivityData[userActivityData.length - 1];
    if (!lastActivity) {
      return;
    }
    const timestamp = new Date().toISOString().replace('T',' ').substring(0, 19)
    const newLastActivity = {
      presence: {timestamp : timestamp , status: 'active' },
      screenshot: null,
      latitude: null,
      longitude: null,
      ip_address: null,
      partner_id: lastActivity.partner_id[0] || null,
      description: lastActivity.description,
      task_id: lastActivity.task_id[0] || null,
      brand_id : lastActivity.brand_id[0] || null,
      pause_id: null,
    }

    await checkDataAndSend(newLastActivity);

    // const lastItem = work_day[work_day.length - 1];
    // const dateLocal = new Date().toLocaleDateString('en-US');
    
    // const endLocalWork = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    // logger.info(`Hora de finalización del trabajo: ${endLocalWork}`);

    // const completeDate = new Date(`${dateLocal} ${endLocalWork}`).toISOString().replace('T',' ').substring(0, 19);
    // const completeDateStartWork = new Date(`${dateLocal} ${lastItem.startWork}`).toISOString().replace('T',' ').substring(0, 19);
    
    // //data para el resumen:
    // const lastData = [{
    //   user_id: parseInt(uid),
    //   partner_id: lastItem.client.id,
    //   start_time: completeDateStartWork,
    //   end_time: completeDate,
    //   total_hours: calculateTimeDifference(lastItem.startWork, endLocalWork),
    //   odoo_id: lastItem.odoo_id
    // }];
    // await sendDataSummary('user.activity.summary', lastData);
  }
  ipcMain.on('close-all-windows', async () => {
    
    
    app.quit();

    
  });

  ipcMain.on('close-modal-window', () => {
    const modalWindows = getModalWindow();
    if (modalWindows) modalWindows.close();
  });

  ipcMain.on('pause-timer', () => {
    createModalWindow();
    getModalWindow().webContents.send('timer-event', 'pause');
  })
  
  ipcMain.on('resume-timer', () => {
    createModalWindow();
    getModalWindow().webContents.send('timer-event', 'resume');
  });

  ipcMain.on('end-task', () => {
    createModalWindow();
  })

  ipcMain.on('prev-hours', () => {
    createModalWindow();
    const modalWindow = getModalWindow();
    if (modalWindow) {
      modalWindow.setSize(450, 560);
      modalWindow.webContents.send('prev-hours');
    }
  })

  ipcMain.on('logout', async () => {
    await sendLastData();
    try {
      
      await clearCredentials();
      
      logger.info('Usuario ha cerrado sesión');

      const mainWindow = getMainWindow();
      if (mainWindow) {
        mainWindow.close();
      }

      stopCronJobs();
      createLoginWindow();
      session = false;
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  });

  ipcMain.on('update-work-day', async (event, data) => {
    const store = await getStore();
    const { uid } = await getCredentials(['uid']);
    store.set(`work-day-${uid}`, data);

    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('work-day-updated', data);
    });
  });

  ipcMain.on('update-work-day-front', async (event, data) => {
    const store = await getStore();
    const { uid } = await getCredentials(['uid']);
    store.set(`work-day-${uid}`, data);

    // // // BrowserWindow.getAllWindows().forEach(win => {
    // // //   win.webContents.send('work-day-updated', work_day);
    // // // });
  });

  ipcMain.on('send-manual-data', async (event, manualData) => {
    
    
    
    // // // const odoo_ids = await checkDataAndSend(manualData);
    // // // const odoo_id = await sendActivityUserSummary();
    
    const [odoo_ids] = await Promise.all([  
      await checkDataAndSend(manualData),
      // await sendActivityUserSummary()
    ]);
    
    logger.info(`Datos enviados: ${odoo_ids}`);
    const store = await getStore();
    const { uid } = await getCredentials(['uid']);
    const work_day = store.get(`work-day-${uid}`) || [];

    const lastItem = work_day.find(rec => rec.odoo_id === ' ');
    

    // const lastItem = work_day[work_day.length - 1];

    lastItem.odoo_ids.push(odoo_ids.odoo_ids);

    // if (lastItem.odoo_id === ' ' ){
    //   lastItem.odoo_id = odoo_id.odoo_id;
    // }
    

    store.set(`work-day-${uid}`, work_day);
    
    BrowserWindow.getAllWindows().forEach(win => {
        
      win.webContents.send('info-send', {
        message: {
          'activity data send': odoo_ids,
          'summary data send': odoo_id,
        }
        
      });
    });
    event.reply('send-manual-data-response');
    
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('work-day-updated', work_day);
    });

    
  });
  //ENVIAR INFO DE ACTIVIDAD

  ipcMain.on('change-timer-status', async (event, timerEventData) => {
    logger.info(`Evento de temporizador recibido: ${timerEventData}`);
    getMainWindow().webContents.send('timer-event', timerEventData);
    if (timerEventData === 'pause') {
      isPaused = true;
      logger.info('Timer en pausa, deteniendo cron jobs');
      stopCronJobs();
      updateActivityPresence();
      schedulePauseAutoResume();
    }

    if (timerEventData === 'resume') {
      isPaused = false;
      clearPauseAutoResume();
      setupCronJobs(currentNotificationMinutes);
      updateActivityPresence();
    }
  })

  ipcMain.on('error-modal', async (evet, message)=>{
    logger.error(`Modal: ${message}`)
  });

  ipcMain.on('send-data', async (event, data) => {
    const { client, description, brand, task, pause, regPrevHour = false} = data;
    logger.info(`Datos recibidos del formulario: ${JSON.stringify({ client, description, task , pause, regPrevHour })}`);
    statusConnection = await checkServerConnection();
    try {
      const { uid } = await getCredentials(['uid']);
      const store = await getStore();
      const offLineaData = store.get('offlineData') || [];
      const clients = store.get('clients') || [];
      // console.log(offLineaData.length);
      const work_day = store.get(`work-day-${uid}`) || [];
      
      //Enviar datos offlinea primero
      if (offLineaData.length > 0 && statusConnection.status) {
        // console.time('time-function-sendLocalData');
        // await sendLocalData('offlineData', 'summary');
        await sendLocalData('offlineData', 'normal');
        // console.timeEnd('time-function-sendLocalData');
        const synchronizeData = await getUserActivity();
        // console.log(synchronizeData)
        const data = buildWorkDayFromOdooData(synchronizeData, uid, clients);
        data.sort((a, b) => a.startWork.localeCompare(b.startWork));
        store.set(`work-day-${uid}`, data);

        BrowserWindow.getAllWindows().forEach(win => {
          win.webContents.send('work-day-updated', data);
        });
      }
      
      const modalWindows = createModalWindow();
      modalWindows.show();

      activityData.partner_id = client;
      activityData.description = description;
      activityData.task_id = task;
      activityData.brand_id = brand;
      activityData.pause_id = pause;
      activityData.presence = { status: 'active', timestamp: new Date().toISOString().replace('T',' ').substring(0, 19) };
  
      const client_data = clients.find(rec => rec.id == client);
      const selectedTask = client_data?.tasks?.find(rec => rec.id === parseInt(task));
      const task_name = selectedTask?.name || ' ';
      const brand_name = client_data['brands'].find( rec => rec.id === parseInt(brand))?.name || ' ';
      const previousHourRange = regPrevHour
        ? {
            ...regPrevHour,
            timeNotification: Number.isFinite(Number(selectedTask?.time_notification))
              ? Number(selectedTask.time_notification)
              : null,
          }
        : false;
      let lastClient = null;
      
      let taskTags = [];
      const rawTaskTags = selectedTask?.task_tags;
      if (Array.isArray(rawTaskTags)) {
        taskTags = rawTaskTags
          .map(tag => String(tag).trim().toLowerCase())
          .filter(Boolean);
      } else if (typeof rawTaskTags === 'string') {
        taskTags = rawTaskTags
          .split(',')
          .map(tag => tag.trim().toLowerCase())
          .filter(Boolean);
      }
      const isPauseTask = taskTags.includes('pausa');
      if (isPauseTask) {
        if (selectedTask && Number.isFinite(Number(selectedTask.time_notification))) {
          pauseAutoResumeMinutes = Number(selectedTask.time_notification);
          if (isPaused) {
          logger.info(`Pausa reanudar notificación en: ${pauseAutoResumeMinutes} minutos`);
            schedulePauseAutoResume();
          }
        } else {
          pauseAutoResumeMinutes = null;
          clearPauseAutoResume();
        }
      } else {
        pauseAutoResumeMinutes = null;
        clearPauseAutoResume();

        if (selectedTask && Number.isFinite(Number(selectedTask.time_notification))) {
          currentNotificationMinutes = Number(selectedTask.time_notification);
          logger.info(`Intervalo de notificación para la tarea: ${currentNotificationMinutes} minutos`);
          if (!previousHourRange) {
            stopCronJobs();
            setupCronJobs(currentNotificationMinutes);
          }
        } else {
          currentNotificationMinutes = null;
          stopCronJobs();
        }
      }
      
      // if (pause > 0) {
      //   const lastPause = work_day.find(rec => rec.pause === true);
      //   if (!lastPause) {
      //     const data_work_day = {
      //       client: { id: client_data.id, name: client_data.name },
      //       brand: brand_name,
      //       date: new Date().toLocaleDateString('en-US'),
      //       startWork: convertDate(activityData.presence.timestamp.split(' ')[1]),
      //       endWork: '00:00',
      //       timeWorked: '00:00',
      //       task: task_name,
      //       description: 'Pausa',
      //       pause: true,
      //       userId: uid,
      //       odoo_id: ' ',
      //       odoo_ids: []
      //     };


      //     const lastItem = work_day.length > 0 ? work_day[work_day.length - 1] : null;
      //     if (lastItem) {
            
      //       lastItem.endWork = convertDate(activityData.presence.timestamp.split(' ')[1]);
      //       lastItem.timeWorked = calculateTimeDifference(lastItem.startWork, lastItem.endWork);
      //     }
      //     work_day.push(data_work_day);
      //     store.set(`work-day-${uid}`, work_day);
      //   } else {
      //     lastPause.endWork = convertDate(activityData.presence.timestamp.split(' ')[1]);
      //     lastPause.timeWorked = calculateTimeDifference(lastPause.startWork, lastPause.endWork);
      //     lastPause.description = 'Pausa';
      //     lastPause.pause = false;
      //     store.set(`work-day-${uid}`, work_day);
      //   }
      
        
      // } 
      // if (!pause  && !regPrevHour) {
      //   if (work_day.length === 0) {
      //     const data_work_day = {
      //       client: client_data,
      //       brand: brand_name,
      //       date: new Date().toLocaleDateString('en-US'),
      //       startWork: convertDate(activityData.presence.timestamp.split(' ')[1]),
      //       endWork: '00:00',
      //       timeWorked: '00:00',
      //       task: task_name,
      //       description: description,
      //       userId: uid,
      //       odoo_id: ' ',
      //       odoo_ids: []
      //     };
    
      //     work_day.push(data_work_day);
      //     store.set(`work-day-${uid}`, work_day);
      //     logger.info(`Primer cliente agregado: ${client_data.name}`);
      //     lastClient = client_data.id;
      //   } else {
      //     const lastItem = work_day[work_day.length - 1];
    
      //     if (lastItem.client.id !== client_data.id || lastItem.brand !== brand_name || lastItem.task !== task_name) {
      //       lastItem.endWork = convertDate(activityData.presence.timestamp.split(' ')[1]);
      //       lastItem.timeWorked = calculateTimeDifference(lastItem.startWork, lastItem.endWork);
      //       const data_work_day = {
      //         client: client_data,
      //         brand: brand_name,
      //         date: new Date().toLocaleDateString('en-US'),
      //         startWork: convertDate(activityData.presence.timestamp.split(' ')[1]),
      //         endWork: '00:00',
      //         timeWorked: '00:00',
      //         task: task_name,
      //         description: description,
      //         userId: uid,
      //         odoo_id: ' ',
      //         odoo_ids: []
      //       };
      //       work_day.push(data_work_day);
      //       store.set(`work-day-${uid}`, work_day);
      //     } else {
      //       lastItem.endWork = convertDate(activityData.presence.timestamp.split(' ')[1]);
      //       lastItem.timeWorked = calculateTimeDifference(lastItem.startWork, lastItem.endWork);
      //       lastItem.description = description;
      //       store.set(`work-day-${uid}`, work_day);
      //     }
      //   }

      // }

      if (previousHourRange) {
        logger.info('Registro de hora previa');
        
        activityData.presence = { status: 'active', timestamp: previousHourRange.timeStart};
        // const data_work_day = {
        //   client: client_data,
        //   brand: brand_name,
        //   date: new Date().toLocaleDateString('en-US'),
        //   startWork: convertDate(regPrevHour.timeStart.split(' ')[1]),
        //   endWork: convertDate(regPrevHour.timeEnd.split(' ')[1]),
        //   timeWorked: calculateTimeDifference(regPrevHour.timeStart.split(' ')[1], regPrevHour.timeEnd.split(' ')[1]),
        //   task: task_name,
        //   description: description,
        //   userId: uid,
        //   odoo_id: ' ',
        //   odoo_ids: []
        // };
      }

      if (!statusConnection.status)  {
        const dataToSend = buildActivityEntries(activityData, previousHourRange);
        logger.warn(`Not connection to server | message: ${statusConnection.message} | data will be saved locally`);
        captureScreen(activityData)
       
        await saveDataLocally(dataToSend, 'offlineData');
        const updatedWorkDay = updateLocalWorkDay(work_day, {
          clientData: client_data,
          brandName: brand_name,
          taskName: task_name,
          description,
          uid,
          timestamp: activityData.presence.timestamp,
          regPrevHour: previousHourRange,
        });
        store.set(`work-day-${uid}`, updatedWorkDay);
        BrowserWindow.getAllWindows().forEach(win => {
          win.webContents.send('work-day-updated', updatedWorkDay);
        });
        event.reply('send-data-response');
        modalWindows.close();
        return;
      } else {
        logger.info('Connection established with server, sending data');
      }
      
      const [activityDataLog] = await Promise.all([
        checkDataAndSend(activityData, previousHourRange),
        // sendActivityUserSummary(),
      ]);

      
    
      if (activityDataLog.status !== 200 ){
        logger.warn(`No se enviaron datos de actividad al servidor: ${activityDataLog.message || activityDataLog.error || 'sin detalle'}`);

        if (isConnectionRelatedFailure(activityDataLog)) {
          const dataToSend = buildActivityEntries(activityData, previousHourRange);

          logger.warn('La conexion se perdio durante el envio. Guardando datos localmente');
          if (!activityDataLog.savedLocally) {
            await saveDataLocally(dataToSend, 'offlineData');
          }
          const updatedWorkDay = updateLocalWorkDay(work_day, {
            clientData: client_data,
            brandName: brand_name,
            taskName: task_name,
            description,
            uid,
            timestamp: activityData.presence.timestamp,
            regPrevHour: previousHourRange,
          });
          store.set(`work-day-${uid}`, updatedWorkDay);
          BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('work-day-updated', updatedWorkDay);
          });
        } else {
          BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('error-occurred', {
              message: activityDataLog.message || 'No se pudo enviar la actividad',
              stack: '',
            });
          });
          BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('work-day-updated', work_day);
          });
        }
      } else {
        logger.info('Data submission successful');
        const userActivityData = await getUserActivity();
        store.set(`data-user-${uid}`, userActivityData);
        activityData.partner_id = null;
        activityData.description = null;

        const work_day_sincronice = buildWorkDayFromOdooData(store.get(`data-user-${uid}`), uid, clients);
        store.set(`work-day-${uid}`, work_day_sincronice);
        // ESPERA PARA QUE SE ACTUALICE EL STORE
        BrowserWindow.getAllWindows().forEach(win => {
          win.webContents.send('work-day-updated', work_day_sincronice);
        });  
      }
      
      
      event.reply('send-data-response');
      //CERRAR MODAL HASTA DESPUES DE ENVIAR LA INFO
      modalWindows.close();

      BrowserWindow.getAllWindows().forEach(win => {
        
        win.webContents.send('info-send', {
          message: {
            'activity data send': activityDataLog,
            // 'summary data send': summaryDataLog,
          }
          
        });
      });
    } catch (error) {
      // console.error('Error procesando los datos:', error);
      logger.error(`Error procesando los datos: ${error.message}`);
  
      
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('error-occurred', {
          message: error.message,
          stack: error.stack,
        });
      });
    }
  });
  


  ipcMain.handle('get-work-day', async (event) => {
    const store = await getStore();
    const { uid } = await getCredentials(['uid']);
    const work_day = store.get(`work-day-${uid}`) || [];
    return work_day;
  });

  ipcMain.handle('get-odoo-config', async (event) => {
    const store = await getStore();
    const odooConfig = store.get('odooConfig') || {};
    return odooConfig;
  });
  
  ipcMain.handle('get-clients-and-pauses', async (event) => {
    const store = await getStore();
    const clients = store.get('clients') || [];
    const pauses = store.get('pauses') || [];
    return {clients, pauses};
  });

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.on('delete_data', async () => {
    const store = await getStore();
    const { uid } = await getCredentials(['uid']);
    store.delete(`work-day-${uid}`);
  });

  ipcMain.on('sendSummary' , () => {
    sendActivityUserSummary();
    logger.info('Resumen de actividad enviado manualmente');
  });

  ipcMain.on('login-success', () => {
    createMainWindow();
    session = true;
    setupCronJobs(currentNotificationMinutes);

    const loginWindow = getLoginWindow();
    if (loginWindow) {
      loginWindow.close();
    }
  });

  app.on('window-all-closed', async () => {
    if (process.platform !== 'darwin') {
        app.quit(); 
    }
});

const sendDataBeforeQuit = async () => {
  try {
      await sendLastData();
      return true;
  } catch (error) {
      console.error('Error enviando los últimos datos:', error);
  }
};

app.on('before-quit', async (event) => {
  if (app.isQuiting) {
      return; 
  }

  event.preventDefault(); 
  app.isQuiting = true; 

  const result = await sendDataBeforeQuit(); 

  if (result === true) {
      app.quit();
  } else {
      app.isQuiting = false; 
  }
});




  //abrir app al enceder la pc
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: false,
  })
  
  app.on('activate', () => {
    const mainWindow = getMainWindow();
    const loginWindow = getLoginWindow();

    if (!mainWindow && !loginWindow) {
      createLoginWindow();
    } else if (mainWindow) {
      mainWindow.show();
    } else if (loginWindow) {
      loginWindow.show();
    }
  });
}
