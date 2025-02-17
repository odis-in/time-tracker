const { app, Tray, Menu, ipcMain, BrowserWindow, net } = require('electron');

// const { autoUpdater, AppUpdater } = require("electron-updater");
const { authenticateUser } = require('./src/odoo/authenticateUser');
const { getClients } = require('./src/odoo/getClients');
const { getTimeNotification } = require('./src/odoo/getTimeNotification');
const { presenceNotification } = require('./src/utils/presenceNotification');
const cron = require('node-cron');
const path = require('path');
const { captureScreen } = require('./src/utils/captureScreen');
const { saveCredentials, getCredentials, clearCredentials } = require('./src/utils/crendentialManager');
const { createLoginWindow, createMainWindow, createModalWindow, getLoginWindow, getMainWindow, getModalWindow } = require('./src/utils/windowaManager');
const { getIpAndLocation } = require('./src/utils/getIPAddress');
const { checkDataAndSend } = require('./src/utils/checkDataAndSend');
const { calculateTimeDifference, convertDate } = require('./src/utils/calculateTimeDifference');
const { sendActivityUserSummary } = require('./src/utils/dataManager');
const nodeNotifier = require('node-notifier');
const { checkServerConnection } = require('./src/utils/checkConnection');
async function getStore() {
  const { default: Store } = await import('electron-store');
  return new Store();
}
// autoUpdater.autoDownload = false;
// autoUpdater.autoInstallOnAppQuit = true;
let tray;
let presenceJob = null;
let screenshotJob = null;
let addressJob = null;
let session = null;

const activityData = {
  odoo_id: null,
  presence: null,
  screenshot: null,
  latitude: null,
  longitude: null,
  ipAddress: null,
  partner_id: null,
  description: null
};

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {

  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    const mainWindow = getMainWindow();
    const loginWindow = getLoginWindow();

    if (mainWindow && mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else if (loginWindow) {
      loginWindow.show();
      loginWindow.focus();
    } else {
      createLoginWindow();
    }
  });

  function createTray() {
    tray = new Tray(path.join(__dirname, './src/assets/img/tele-trabajo.png'));
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
          app.isQuiting = true;
          app.quit();
        }
      }
    ]);

    tray.setToolTip('time-tracker');
    tray.setContextMenu(contextMenu);
  }

  async function setupCronJobs() {
    const { timeNotification } = await getCredentials(['timeNotification']);

    if (!timeNotification) {
      console.log('No se ha definido la hora de notificación');
      return;
    }

    const notifationInterval = parseInt(timeNotification);

    presenceJob = cron.schedule(`*/${notifationInterval} * * * *`, () => {
      presenceNotification(activityData);
    });

    screenshotJob = cron.schedule(`*/${notifationInterval} * * * *`, () => {
      captureScreen(activityData);
      

    });

    addressJob = cron.schedule(`*/${notifationInterval} * * * *`, () => {
      getIpAndLocation(activityData)
    });

    if (presenceJob || screenshotJob || addressJob) {
      console.log("Cron jobs ya están configurados");
      return;
    }
  }

  async function verifyCredentialsOnStart() {
    try {
      const { username, password, url, db , uid, session_id, timeNotification } = await getCredentials(['username', 'password', 'url', 'db', 'uid', 'session_id','timeNotification']);
      console.log(username, password, url, db, uid);
      if (username && password) {
        createMainWindow();
        session = true;
        console.log('Credenciales encontradas:', username, password, url, db, session, uid, timeNotification);
        console.time('-----------------NET CONECTION-----------------')
        console.log('¿Está online?', net.isOnline());
        console.timeEnd('-----------------NET CONECTION-----------------')
        const online = await checkServerConnection();
        if (online) {
          const clients = await getClients(session_id, url);
          const store = await getStore();
          store.set('clients', clients);
          store.set('connected', online);
        } else {
          console.log('---------------------------------------------------no conectado mi version')
        }
        setupCronJobs();
      } else {
        createLoginWindow();
        session = false;
      }
    } catch (error) {
      console.error('Error al verificar las credenciales:', error);
      createLoginWindow();
    }
  }

  function stopCronJobs() {
    if (presenceJob) {
      presenceJob.stop();
    }
    if (screenshotJob) {
      screenshotJob.stop();
    }
  }

  app.whenReady().then(() => {
    
    verifyCredentialsOnStart();
    createTray();
    
    // autoUpdater.checkForUpdates();
    ipcMain.handle('login', async (event, username, password, url, db) => {
      try {
        
        const { setCookieHeader, uid, imageBase64 , name } = await authenticateUser(username, password, url, db);
        const [clients ,tm, store] = await Promise.all([
          getClients(setCookieHeader, url),
          getTimeNotification(setCookieHeader, url),
          getStore()
        ]);

        await saveCredentials(username, password, url, tm.time_notification.toString() , uid.toString(), setCookieHeader.toString(), db);
       
        console.log('tm',tm);
        store.set('clients', clients);
        return {uid , name , imageBase64 };
        
      } catch (error) {
        console.error('Error al autenticar con Odoo:', error);
        throw error;
      }
    });
  });

  // autoUpdater.on("update-available", (info) => {
  //   console.log(`Update available. Current version ${app.getVersion()}`);
  //   nodeNotifier.notify({
  //     title: 'Actualización disponible',
  //     message: 'Hay una actualización disponible para la aplicación',
  //     icon: path.join(__dirname, './src/assets/img/tele-trabajo.png'),
  //     sound: true,
  //     wait: true
  //   });
  //   autoUpdater.downloadUpdate(); 
  //   tray.setToolTip('comenzando la descarga'); // Descarga la actualización
  // });
  
  // autoUpdater.on("update-downloaded", (info) => {
  //   console.log(`Update downloaded. Current version ${app.getVersion()}`);
  //   nodeNotifier.notify({
  //     title: 'Actualización descargada',
  //     message: 'La actualización ha sido descargada y está lista para ser instalada',
  //     icon: path.join(__dirname, './src/assets/img/tele-trabajo.png'),
  //     sound: true,
  //     wait: true
  //   });
  // });

  // autoUpdater.on('download-progress', (progressObj) => {
  //   const { percent } = progressObj;
  
  //   tray.setToolTip(`Descargando actualización... ${percent.toFixed(2)}%`);
 
  // });

  // autoUpdater.on("error", (info) => {
  //   console.log(`Error in auto-updater. ${info}`);
  //   nodeNotifier.notify({
  //     title: 'Error en la actualización',
  //     message: `Error durante la actualización: ${info}`,
  //     icon: path.join(__dirname, './src/assets/img/tele-trabajo.png'),
  //     sound: true,
  //     wait: true
  //   });


  // });

  ipcMain.on('close-main-window', () => {
    const mainWindow = getMainWindow();
    const loginWindow = getLoginWindow();
    if (mainWindow) mainWindow.close();
    if (loginWindow) loginWindow.close();
  });

  ipcMain.on('close-modal-window', () => {
    const modalWindows = getModalWindow();
    if (modalWindows) modalWindows.close();
  });

  ipcMain.on('logout', async () => {
    try {
      await clearCredentials();
      console.log('Credenciales eliminadas');

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

  ipcMain.on('send-manual-data', async (event, manualData) => {
    
    console.time('----------------------MANUAL DATA----------------------')
    const odoo_ids = await checkDataAndSend(manualData);
    const odoo_id = await sendActivityUserSummary();
    
    console.log('Datos enviados:', odoo_ids, odoo_id);
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

    console.timeEnd('----------------------MANUAL DATA----------------------')
    // BrowserWindow.getAllWindows().forEach(win => {
    //   win.webContents.send('work-day-updated', work_day);
    // });
  });

  ipcMain.on('send-data', async (event, client, description) => {
    try {
      const store = await getStore();
      const modalWindows = getModalWindow();
      console.log('Datos recibidos del formulario:', { client, description });
      const { uid } = await getCredentials(['uid']);
      // Asignación de datos a `activityData`
      activityData.partner_id = client;
      activityData.description = description;
  
      const client_data = store.get('clients').find(rec => rec.id == client);
      if (client_data) {
        console.log('Cliente encontrado:', client_data);
      } else {
        console.log('Cliente no encontrado');
      }
      
      const work_day = store.get(`work-day-${uid}`) || [];
      console.log('LEYENDO ACA ANTES DE CREAR NUEVO REGISTRO', work_day);
      let lastClient = null;
      console.time('prepareDatd')
      if (work_day.length === 0) {
        const data_work_day = {
          client: client_data,
          date: new Date().toLocaleDateString('en-US'),
          startWork: convertDate(activityData.presence.timestamp.split(' ')[1]),
          endWork: '00:00',
          timeWorked: '00:00',
          description: description,
          userId: uid,
          odoo_id: ' ',
          odoo_ids: []
        };
  
        work_day.push(data_work_day);
        store.set(`work-day-${uid}`, work_day);
        console.log('Primer cliente agregado:', store.get(`work-day-${uid}`));
        lastClient = client_data.name;
      } else {
        const lastItem = work_day[work_day.length - 1];
  
        if (lastItem.client.name !== client_data.name) {
          lastItem.endWork = convertDate(activityData.presence.timestamp.split(' ')[1]);
          lastItem.timeWorked = calculateTimeDifference(lastItem.startWork, lastItem.endWork);
          const data_work_day = {
            client: client_data,
            date: new Date().toLocaleDateString('en-US'),
            startWork: convertDate(activityData.presence.timestamp.split(' ')[1]),
            endWork: '00:00',
            timeWorked: '00:00',
            description: description,
            userId: uid,
            odoo_id: ' ',
            odoo_ids: []
          };
          work_day.push(data_work_day);
          store.set(`work-day-${uid}`, work_day);
          console.log('LEYENDO ACA DESPUES DE CREAR NUEVO REGISTRO', work_day);
        } else {
          lastItem.endWork = convertDate(activityData.presence.timestamp.split(' ')[1]);
          lastItem.timeWorked = calculateTimeDifference(lastItem.startWork, lastItem.endWork);
          lastItem.description = description;
          store.set(`work-day-${uid}`, work_day);
        }
      }
  
      // Enviar datos actualizados a las ventanas del navegador
    
  
      
      modalWindows.close();
      console.timeEnd('prepareDatd')
      // const odoo_id = await checkDataAndSend(activityData);
      console.time("Total Execution");
      
      const [activityDataLog, summaryDataLog] = await Promise.all([
        checkDataAndSend(activityData),
        sendActivityUserSummary(),
      ]);
      
      console.timeEnd("Total Execution");
      
      
      activityData.partner_id = null;
      activityData.description = null;

      const work_day_sincronice = store.get(`work-day-${uid}`) || [];
      console.log('ANTES DE ACTULIAR ODOO_ID', work_day_sincronice)
      const addIdLasItem = work_day_sincronice[work_day.length - 1];
      
      addIdLasItem.odoo_ids.push(activityDataLog.odoo_ids);
      if (addIdLasItem.odoo_id === ' ' ){
        addIdLasItem.odoo_id = summaryDataLog.odoo_id;
      }
      
      store.set(`work-day-${uid}`, work_day_sincronice);


      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('work-day-updated', work_day_sincronice);
      });



      // console.log('##################################################################')
      // console.log('Datos enviados:', summaryDataLog, activityDataLog);
      // console.log('##################################################################')
      BrowserWindow.getAllWindows().forEach(win => {
        
        win.webContents.send('info-send', {
          message: {
            'activity data send': activityDataLog,
            'summary data send': summaryDataLog,
          }
          
        });
      });
    } catch (error) {
      console.error('Error procesando los datos:', error);
  
      
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

  ipcMain.handle('get-clients', async (event) => {
    const store = await getStore();
    const clients = store.get('clients') || [];
    return clients;
  });

  ipcMain.on('delete_data', async () => {
    const store = await getStore();
    const { uid } = await getCredentials(['uid']);
    store.delete(`work-day-${uid}`);
  });

  ipcMain.on('sendSummary' , () => {
    sendActivityUserSummary();
    console.log('Enviando resumen de actividad');
  });

  ipcMain.on('login-success', () => {
    createMainWindow();
    session = true;
    setupCronJobs();

    const loginWindow = getLoginWindow();
    if (loginWindow) {
      loginWindow.close();
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
  // app.setLoginItemSettings({
  //   openAtLogin: true,
  //   openAsHidden: false,
  // })
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