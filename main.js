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
const { checkDataAndSend } = require('./src/utils/checkDataAndSend');
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

function buildWorkDayFromOdooData(synchronizeData, uid) {
  const activities = Array.isArray(synchronizeData?.activities) ? synchronizeData.activities : [];
  const summaries = Array.isArray(synchronizeData?.summaries) ? synchronizeData.summaries : [];
  const activitiesSorted = [...activities].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );
  const summarySorted = [...summaries].sort(
    (a, b) => new Date(a.start_time) - new Date(b.start_time)
  );

  const rows = [];
  let current = null;

  const getActivityTime = activity => {
    if (!activity?.timestamp) return null;
    const activityTime = new Date(activity.timestamp);
    return Number.isNaN(activityTime) ? null : activityTime;
  };

  activitiesSorted.forEach(activity => {
    const activityTime = getActivityTime(activity);
    if (!activityTime) return;

    const clientId = activity.partner_id?.[0] || 0;
    const clientName = activity.partner_id?.[1] || ' ';
    const taskName = activity.task_id ? activity.task_id[1] : ' ';
    const brandName = activity.brand_id ? activity.brand_id[1] || ' ' : ' ';
    const description = activity.pause_id ? activity.pause_id[1] : (activity.description || ' ');

    if (!current) {
      current = {
        client: { id: clientId, name: clientName },
        date: new Date().toLocaleDateString('en-US'),
        startWork: convertDate(activity.timestamp.split(' ')[1]),
        endWork: convertDate(activity.timestamp.split(' ')[1]),
        timeWorked: '00:00',
        task: taskName,
        description: description,
        brand: brandName,
        userId: uid,
        odoo_id: ' ',
        odoo_ids: [activity.id],
        startTimestamp: activityTime,
        endTimestamp: activityTime,
        partnerId: clientId
      };
      rows.push(current);
      return;
    }

    const isSameGroup =
      current.client.id === clientId &&
      current.brand === brandName &&
      current.task === taskName;

    if (!isSameGroup) {
      current = {
        client: { id: clientId, name: clientName },
        date: new Date().toLocaleDateString('en-US'),
        startWork: convertDate(activity.timestamp.split(' ')[1]),
        endWork: convertDate(activity.timestamp.split(' ')[1]),
        timeWorked: '00:00',
        task: taskName,
        description: description,
        brand: brandName,
        userId: uid,
        odoo_id: ' ',
        odoo_ids: [activity.id],
        startTimestamp: activityTime,
        endTimestamp: activityTime,
        partnerId: clientId
      };
      rows.push(current);
      return;
    }

    current.endWork = convertDate(activity.timestamp.split(' ')[1]);
    current.endTimestamp = activityTime;
    current.timeWorked = calculateTimeDifference(current.startWork, current.endWork);
    current.description = description;
    current.odoo_ids.push(activity.id);
  });

  if (rows.length === 0 && summarySorted.length === 0) {
    return [];
  }

  if (rows.length === 0) {
    return summarySorted.map(summary => ({
      client: { id: summary.partner_id[0], name: summary.partner_id[1] },
      date: new Date().toLocaleDateString('en-US'),
      startWork: convertDate(summary.start_time.split(' ')[1]),
      endWork: convertDate(summary.end_time.split(' ')[1]),
      timeWorked: summary.total_hours,
      task: ' ',
      description: ' ',
      brand: ' ',
      userId: uid,
      odoo_id: summary.id,
      odoo_ids: []
    }));
  }

  const usedSummaries = new Set();

  rows.forEach(row => {
    const summary = summarySorted.find(candidate => {
      if (usedSummaries.has(candidate.id)) return false;
      if (candidate.partner_id?.[0] !== row.partnerId) return false;
      const summaryStart = new Date(candidate.start_time);
      const summaryEnd = new Date(candidate.end_time);
      if (Number.isNaN(summaryStart) || Number.isNaN(summaryEnd)) return false;
      return row.startTimestamp >= summaryStart && row.endTimestamp <= summaryEnd;
    });

    if (summary) {
      usedSummaries.add(summary.id);
      row.odoo_id = summary.id;
      row.endWork = convertDate(summary.end_time.split(' ')[1]);
      row.timeWorked = summary.total_hours;
      row.endTimestamp = new Date(summary.end_time);
    }
  });

  return rows.map(row => {
    const { startTimestamp, endTimestamp, partnerId, ...cleanRow } = row;
    return cleanRow;
  });
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
          const work_day = store.get(`work-day-${uid}`) || [];
          store.set(`data-user-${uid}`, userActivityData);
          const synchronizeData = store.get(`data-user-${uid}`) || { summaries: [], activities: [] };
          const data = buildWorkDayFromOdooData(synchronizeData, uid);
          data.sort((a, b) => a.startWork.localeCompare(b.startWork));
          store.set(`work-day-${uid}`, data);
          
          BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('work-day-updated', work_day);
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
        
        const work_day = store.get(`work-day-${uid}`) || [];
        store.set(`data-user-${uid}`, userActivityData);
        const synchronizeData = store.get(`data-user-${uid}`) || { summaries: [], activities: [] };
        const data = buildWorkDayFromOdooData(synchronizeData, uid);
        data.sort((a, b) => a.startWork.localeCompare(b.startWork));
        store.set(`work-day-${uid}`, data);

        BrowserWindow.getAllWindows().forEach(win => {
          win.webContents.send('work-day-updated', work_day);
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
    const work_day = store.get(`work-day-${uid}`) || [];
    if (work_day.length === 0) {
      return;
    }
    const lastItem = work_day[work_day.length - 1];
    const dateLocal = new Date().toLocaleDateString('en-US');
    
    const endLocalWork = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    logger.info(`Hora de finalización del trabajo: ${endLocalWork}`);

    const completeDate = new Date(`${dateLocal} ${endLocalWork}`).toISOString().replace('T',' ').substring(0, 19);
    const completeDateStartWork = new Date(`${dateLocal} ${lastItem.startWork}`).toISOString().replace('T',' ').substring(0, 19);
    
    //data para el resumen:
    const lastData = [{
      user_id: parseInt(uid),
      partner_id: lastItem.client.id,
      start_time: completeDateStartWork,
      end_time: completeDate,
      total_hours: calculateTimeDifference(lastItem.startWork, endLocalWork),
      odoo_id: lastItem.odoo_id
    }];
    await sendDataSummary('user.activity.summary', lastData);
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
    getModalWindow().webContents.send('prev-hours');
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
    const work_day = store.set(`work-day-${uid}`, data);
    // console.log('Datos actualizados:', store.get('work-day'));

    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('work-day-updated', work_day);
    });
  });

  ipcMain.on('update-work-day-front', async (event, data) => {
    const store = await getStore();
    const { uid } = await getCredentials(['uid']);
    const work_day = store.set(`work-day-${uid}`, data);
    // console.log('Datos actualizados:', store.get('work-day'));

    // // // BrowserWindow.getAllWindows().forEach(win => {
    // // //   win.webContents.send('work-day-updated', work_day);
    // // // });
  });

  ipcMain.on('send-manual-data', async (event, manualData) => {
    
    
    
    // // // const odoo_ids = await checkDataAndSend(manualData);
    // // // const odoo_id = await sendActivityUserSummary();
    
    const [odoo_ids, odoo_id] = await Promise.all([  
      await checkDataAndSend(manualData),
      await sendActivityUserSummary()
    ]);
    
    console.log('Datos enviados:', odoo_ids, odoo_id);
    logger.info(`Datos enviados: ${odoo_ids}, Resumen: ${odoo_id}`);
    const store = await getStore();
    const { uid } = await getCredentials(['uid']);
    const work_day = store.get(`work-day-${uid}`) || [];

    const lastItem = work_day.find(rec => rec.odoo_id === ' ');
    

    // const lastItem = work_day[work_day.length - 1];

    lastItem.odoo_ids.push(odoo_ids.odoo_ids);

    if (lastItem.odoo_id === ' ' ){
      lastItem.odoo_id = odoo_id.odoo_id;
    }
    

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
      // console.log(offLineaData.length);
      const work_day = store.get(`work-day-${uid}`) || [];
      
      //Enviar datos offlinea primero
      if (offLineaData.length > 0 && statusConnection.status) {
        // console.time('time-function-sendLocalData');
        await sendLocalData('offlineData', 'summary');
        await sendLocalData('offlineData', 'normal');
        // console.timeEnd('time-function-sendLocalData');
        const synchronizeData = await getUserActivity();
        // console.log(synchronizeData)
        const data = buildWorkDayFromOdooData(synchronizeData, uid);
        data.sort((a, b) => a.startWork.localeCompare(b.startWork));
        store.set(`work-day-${uid}`, data);

        BrowserWindow.getAllWindows().forEach(win => {
          win.webContents.send('work-day-updated', work_day);
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
  
      const client_data = store.get('clients').find(rec => rec.id == client);
      const selectedTask = client_data?.tasks?.find(rec => rec.id === parseInt(task));
      const task_name = selectedTask?.name || ' ';
      const brand_name = client_data['brands'].find( rec => rec.id === parseInt(brand))?.name || ' ';
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
          const newInterval = Number(selectedTask.time_notification);
          currentNotificationMinutes = newInterval;
          logger.info(`Intervalo de notificación para la tarea: ${newInterval} minutos`);
          // Reiniciar el contador siempre al enviar cambio de tarea.
          if (!regPrevHour) {
            logger.info('Reiniciando contador de notificación por cambio de tarea');
            stopCronJobs();
            setupCronJobs(currentNotificationMinutes);
          }
        } else {
          currentNotificationMinutes = null;
          stopCronJobs();
        }
      }
      
      if (pause > 0) {
        const lastPause = work_day.find(rec => rec.pause === true);
        if (!lastPause) {
          const data_work_day = {
            client: { id: client_data.id, name: client_data.name },
            brand: brand_name,
            date: new Date().toLocaleDateString('en-US'),
            startWork: convertDate(activityData.presence.timestamp.split(' ')[1]),
            endWork: '00:00',
            timeWorked: '00:00',
            task: task_name,
            description: 'Pausa',
            pause: true,
            userId: uid,
            odoo_id: ' ',
            odoo_ids: []
          };


          const lastItem = work_day.length > 0 ? work_day[work_day.length - 1] : null;
          if (lastItem) {
            
            lastItem.endWork = convertDate(activityData.presence.timestamp.split(' ')[1]);
            lastItem.timeWorked = calculateTimeDifference(lastItem.startWork, lastItem.endWork);
          }
          work_day.push(data_work_day);
          store.set(`work-day-${uid}`, work_day);
        } else {
          lastPause.endWork = convertDate(activityData.presence.timestamp.split(' ')[1]);
          lastPause.timeWorked = calculateTimeDifference(lastPause.startWork, lastPause.endWork);
          lastPause.description = 'Pausa';
          lastPause.pause = false;
          store.set(`work-day-${uid}`, work_day);
        }
      
        
      } 
      if (!pause  && !regPrevHour) {
        if (work_day.length === 0) {
          const data_work_day = {
            client: client_data,
            brand: brand_name,
            date: new Date().toLocaleDateString('en-US'),
            startWork: convertDate(activityData.presence.timestamp.split(' ')[1]),
            endWork: '00:00',
            timeWorked: '00:00',
            task: task_name,
            description: description,
            userId: uid,
            odoo_id: ' ',
            odoo_ids: []
          };
    
          work_day.push(data_work_day);
          store.set(`work-day-${uid}`, work_day);
          logger.info(`Primer cliente agregado: ${client_data.name}`);
          lastClient = client_data.id;
        } else {
          const lastItem = work_day[work_day.length - 1];
    
          if (lastItem.client.id !== client_data.id || lastItem.brand !== brand_name || lastItem.task !== task_name) {
            lastItem.endWork = convertDate(activityData.presence.timestamp.split(' ')[1]);
            lastItem.timeWorked = calculateTimeDifference(lastItem.startWork, lastItem.endWork);
            const data_work_day = {
              client: client_data,
              brand: brand_name,
              date: new Date().toLocaleDateString('en-US'),
              startWork: convertDate(activityData.presence.timestamp.split(' ')[1]),
              endWork: '00:00',
              timeWorked: '00:00',
              task: task_name,
              description: description,
              userId: uid,
              odoo_id: ' ',
              odoo_ids: []
            };
            work_day.push(data_work_day);
            store.set(`work-day-${uid}`, work_day);
          } else {
            lastItem.endWork = convertDate(activityData.presence.timestamp.split(' ')[1]);
            lastItem.timeWorked = calculateTimeDifference(lastItem.startWork, lastItem.endWork);
            lastItem.description = description;
            store.set(`work-day-${uid}`, work_day);
          }
        }

      }

      if (regPrevHour) {
        logger.info('Registro de hora previa');
        
        activityData.presence = { status: 'active', timestamp: regPrevHour.timeStart};
        const data_work_day = {
          client: client_data,
          brand: brand_name,
          date: new Date().toLocaleDateString('en-US'),
          startWork: convertDate(regPrevHour.timeStart.split(' ')[1]),
          endWork: convertDate(regPrevHour.timeEnd.split(' ')[1]),
          timeWorked: calculateTimeDifference(regPrevHour.timeStart.split(' ')[1], regPrevHour.timeEnd.split(' ')[1]),
          task: task_name,
          description: description,
          userId: uid,
          odoo_id: ' ',
          odoo_ids: []
        };
        work_day.push(data_work_day);
        work_day.sort((a, b) => a.startWork.localeCompare(b.startWork));
        store.set(`work-day-${uid}`, work_day);
      }

      if (!statusConnection.status)  {
        logger.warn(`Not connection to server | message: ${statusConnection.message} | data will be saved locally`);
        await captureScreen(activityData);
        const dataToSend = {
          timestamp: activityData.presence.timestamp,
          presence_status: activityData.presence.status,
          screenshot: activityData.screenshot?.path || null,
          latitude: activityData.latitude,
          longitude: activityData.longitude,
          ip_address: activityData.ipAddress,
          partner_id: activityData.partner_id || null,
          description: activityData.description || null,
          task_id: activityData.task_id || null,
          brand_id : activityData.brand_id || null,
          pause_id : activityData.pause_id || null,
        };
        saveDataLocally(dataToSend, 'offlineData');
        BrowserWindow.getAllWindows().forEach(win => {
          win.webContents.send('work-day-updated', work_day);
        });
        event.reply('send-data-response');
        modalWindows.close();
        return;
      } else {
        logger.info('Connection established with server, sending data');
      }
      
      const [activityDataLog, summaryDataLog] = await Promise.all([
        checkDataAndSend(activityData),
        sendActivityUserSummary(),
      ]);

      
    
      if (activityDataLog.status !== 200 ){
        logger.warn(`No se enviaron datos de actividad al servidor: ${activityDataLog.message || activityDataLog.error || 'sin detalle'}`);
        BrowserWindow.getAllWindows().forEach(win => {
          win.webContents.send('error-occurred', {
            message: activityDataLog.message || 'No se pudo enviar la actividad',
            stack: '',
          });
        });
        BrowserWindow.getAllWindows().forEach(win => {
          win.webContents.send('work-day-updated', work_day);
        });  
      } else {
        logger.info('Data submission successful');
        const userActivityData = await getUserActivity();
        store.set(`data-user-${uid}`, userActivityData);
        activityData.partner_id = null;
        activityData.description = null;

        const work_day_sincronice = store.get(`work-day-${uid}`) || [];
        const addIdLasItem = work_day_sincronice[work_day.length - 1];
        addIdLasItem.odoo_ids.push(activityDataLog.odoo_ids);
        if (addIdLasItem.odoo_id === ' ' ){
          addIdLasItem.odoo_id = summaryDataLog.odoo_id;
        }
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
            'summary data send': summaryDataLog,
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
