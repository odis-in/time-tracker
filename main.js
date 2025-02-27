const { app, Tray, Menu, ipcMain, BrowserWindow, net } = require('electron');

const { autoUpdater, AppUpdater } = require("electron-updater");
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
const { getUserActivity } = require('./src/odoo/getUserActivity');
const { sendDataSummary } = require('./src/odoo/sendData');
const { getDataPause } = require('./src/odoo/getDataPuase');
async function getStore() {
  const { default: Store } = await import('electron-store');
  return new Store();
}
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
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
  description: null,
  task_id: null,
  pause_id: null,
};

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {

  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    const mainWindow = getMainWindow();
    const loginWindow = getLoginWindow();

    // // // if (mainWindow && mainWindow.isMinimized()) {
    // // //   mainWindow.restore();
    // // // }

    // // // if (mainWindow && session) {
    // // //   console.log('------------------SESION------------------------------')
    // // //   coonsole.log(session);
    // // //   mainWindow.show();
    // // //   mainWindow.focus();
    // // // } else if (loginWindow) {
    // // //   console.log('------------------SESION------------------------------')
    // // //   coonsole.log(session);
    // // //   loginWindow.show();
    // // //   loginWindow.focus();
    // // // } else {
      
    // // //   createLoginWindow();
    // // // }

    if (session) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      loginWindow.show();
      loginWindow.focus();
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
          app.quit();
        }
      }
    ]);

    tray.setToolTip('time-tracker');
    tray.setContextMenu(contextMenu);
  }
  
  function firstNotification() {
    presenceNotification(activityData);
    captureScreen(activityData);
    getIpAndLocation(activityData);
  }

  function pauseNotification() {
    captureScreen(activityData);
    getIpAndLocation(activityData);
    const timestamp = new Date().toISOString().replace('T',' ').substring(0, 19);
    activityData.presence = { status: 'active', timestamp: timestamp }
  }

  function resumeNotification() {
    captureScreen(activityData);
    getIpAndLocation(activityData);
    const timestamp = new Date().toISOString().replace('T',' ').substring(0, 19);
    activityData.presence = { status: 'active', timestamp: timestamp }
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

    if (presenceJob && screenshotJob && addressJob) {
      console.log("Cron jobs ya están configurados");
      return;
    }
  }

  async function verifyCredentialsOnStart() {
    try {
      
      const { username, password, url, db , uid, session_id, timeNotification } = await getCredentials(['username', 'password', 'url', 'db', 'uid', 'session_id','timeNotification']);

      if (username && password) {
        console.time('CATCH')
        try {
          const[clients, userActivityData, tm , connection, pausas] = await Promise.all([
            getClients(session_id, url),
            getUserActivity(),
            getTimeNotification(session_id, url),
            checkServerConnection(),
            getDataPause()
          ]);
          
          await saveCredentials(username, password, url, tm.time_notification.toString()  , uid, session_id, db);
          session = true;
          console.log(`Credenciales encontradas:, username: ${username}, password: ${password}, url: ${url} , db ${db}, session ${session}, uid: ${uid}, timeNotification ${timeNotification} `);
          
          const store = await getStore();
          const work_day = store.get(`work-day-${uid}`) || [];
          store.set(`data-user-${uid}`, userActivityData);
          const synchronizeData = store.get(`data-user-${uid}`) || { summaries: [], activities: [] };
          let data = [];
          let groupedActivities = [];
          let usedActivities = new Set(); 
          
          synchronizeData.summaries.forEach((summary, index) => {
            let summaryPartnerId = summary.partner_id[0];
            let nextSummary = synchronizeData.summaries[index + 1];
  
            let activitiesForSummary = synchronizeData.activities
              .filter(activity => 
                activity.partner_id[0] === summaryPartnerId && 
                !usedActivities.has(activity.id) 
              )
              .map(activity => {
                usedActivities.add(activity.id);
                return activity.id;
              });
  
            // Si el siguiente summary tiene el mismo partner_id, separamos correctamente
            if (nextSummary && nextSummary.partner_id[0] === summaryPartnerId) {
              groupedActivities.push([activitiesForSummary[0]]); // Solo el primer elemento en un nuevo grupo
              activitiesForSummary.shift(); 
            }
  
            // Agregamos el resto de actividades (si quedan)
            if (activitiesForSummary.length > 0) {
              groupedActivities.push(activitiesForSummary);
            }
          });
  
          synchronizeData.summaries.forEach((element, index) => {
            
            const activity = synchronizeData.activities.find(rec => 
              rec.partner_id[0] === element.partner_id[0] && rec.description !== false              
            );
            const todayFormatted = new Date().toLocaleDateString('en-US');
            const activitiesForSummary = groupedActivities[index] || [];
            const data_work_day = {
              client: { id: element.partner_id[0], name: element.partner_id[1] },
              date: todayFormatted,
              startWork: convertDate(element.start_time.split(' ')[1]),
              endWork: convertDate(element.end_time.split(' ')[1]),
              timeWorked: element.total_hours,
              description: activity  ? activity.description  || ' ' : ' ',
              userId: uid,
              odoo_id: element.id,
              odoo_ids: activitiesForSummary
            };
  
            data.push(data_work_day);
          });
  
          
          data.sort((a, b) => a.startWork.localeCompare(b.startWork))
          store.set(`work-day-${uid}`, data);
          
          BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('work-day-updated', work_day);
          });
          
          store.set('clients', clients);
          store.set('pauses', pausas);
        } catch(error) {
          console.log('Error al iniciar', error);
        }
        console.timeEnd('CATCH')
        
      
      
      createMainWindow();
      firstNotification();
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
    
    autoUpdater.checkForUpdates();
    ipcMain.handle('login', async (event, username, password, url, db) => {
      try {
        
        const { setCookieHeader, uid, imageBase64 , name } = await authenticateUser(username, password, url, db);
        const [clients ,tm ,store] = await Promise.all([
          getClients(setCookieHeader, url),
          getTimeNotification(setCookieHeader, url),
          getStore()
        ]);
        console.log('--------------------UID--------------------------')
        console.log('UID:', uid);

        await saveCredentials(username, password, url, tm.time_notification.toString() , uid.toString(), setCookieHeader.toString(), db);
        const pauses = await getDataPause()
        const userActivityData = await getUserActivity();
        firstNotification();
        console.timeEnd('-----------------GET USER ACTIVITY-----------------')
        const work_day = store.get(`work-day-${uid}`) || [];
        console.log('-----------------USER ODOO DATA-----------------')
        console.log(userActivityData);
        store.set(`data-user-${uid}`, userActivityData);
        const synchronizeData = store.get(`data-user-${uid}`) || { summaries: [], activities: [] };
        let data = [];
        // // // let groupedActivities = [];
        // // // let currentGroup = [];

        // Recorremos las actividades
        // // // synchronizeData.activities.forEach((activity, index, activities) => {
        // // //   // Si currentGroup está vacío, agregamos la primera actividad
        // // //   if (currentGroup.length === 0) {
        // // //     currentGroup.push(activity.id);
        // // //   } else {
        // // //     // Si el partner_id es el mismo que el anterior y son consecutivos, se agrupan
        // // //     if (activity.partner_id[0] === synchronizeData.activities[index - 1].partner_id[0]) {
        // // //       currentGroup.push(activity.id);
        // // //     } else {
        // // //       // Si el grupo tiene más de un elemento, lo agregamos al resultado
        // // //       groupedActivities.push(currentGroup);
        // // //       // Iniciamos un nuevo grupo con el registro actual
        // // //       currentGroup = [activity.id];
        // // //     }
        // // //   }
        
        // // //   // Si es la última actividad, aseguramos de agregar el último grupo
        // // //   if (index === activities.length - 1) {
        // // //     groupedActivities.push(currentGroup);
        // // //   }
        // // // });


        let groupedActivities = [];
        let usedActivities = new Set(); // Para evitar duplicados

        synchronizeData.summaries.forEach((summary, index) => {
          let summaryPartnerId = summary.partner_id[0];
          let nextSummary = synchronizeData.summaries[index + 1];

          let activitiesForSummary = synchronizeData.activities
            .filter(activity => 
              activity.partner_id[0] === summaryPartnerId && 
              !usedActivities.has(activity.id) // Evitamos reusar actividades
            )
            .map(activity => {
              usedActivities.add(activity.id);
              return activity.id;
            });

          // Si el siguiente summary tiene el mismo partner_id, separamos correctamente
          if (nextSummary && nextSummary.partner_id[0] === summaryPartnerId) {
            groupedActivities.push([activitiesForSummary[0]]); // Solo el primer elemento en un nuevo grupo
            activitiesForSummary.shift(); // Eliminamos el primero del array original
          }

          // Agregamos el resto de actividades (si quedan)
          if (activitiesForSummary.length > 0) {
            groupedActivities.push(activitiesForSummary);
          }
        });

        synchronizeData.summaries.forEach((element, index) => {
          
          const activity = synchronizeData.activities.find(rec => 
            rec.partner_id[0] === element.partner_id[0] && rec.description !== false              
          );
          const todayFormatted = new Date().toLocaleDateString('en-US');
          const activitiesForSummary = groupedActivities[index] || [];
          const data_work_day = {
            client: { id: element.partner_id[0], name: element.partner_id[1] },
            date: todayFormatted,
            startWork: convertDate(element.start_time.split(' ')[1]),
            endWork: convertDate(element.end_time.split(' ')[1]),
            timeWorked: element.total_hours,
            description: activity  ? activity.description  || ' ' : ' ',
            userId: uid,
            odoo_id: element.id,
            odoo_ids: activitiesForSummary
          };

          data.push(data_work_day);
        });
        data.sort((a, b) => a.startWork.localeCompare(b.startWork))
        store.set(`work-day-${uid}`, data);

        BrowserWindow.getAllWindows().forEach(win => {
          win.webContents.send('work-day-updated', work_day);
        });
        console.log('tm',tm);
        store.set('clients', clients);
        store.set('pauses', pauses);
        return {uid , name , imageBase64 };
        
      } catch (error) {
        console.error('Error al autenticar con Odoo:', error);
        throw error;
      }
    });
  });

  autoUpdater.on("update-available", (info) => {
    console.log(`Update available. Current version ${app.getVersion()}`);
    nodeNotifier.notify({
      title: 'Actualización disponible',
      message: 'Hay una actualización disponible para la aplicación',
      icon: path.join(__dirname, './src/assets/img/tele-trabajo.png'),
      sound: true,
      wait: true
    });
    autoUpdater.downloadUpdate(); 
    tray.setToolTip('comenzando la descarga'); // Descarga la actualización
  });
  
  autoUpdater.on("update-downloaded", (info) => {
    console.log(`Update downloaded. Current version ${app.getVersion()}`);
    nodeNotifier.notify({
      title: 'Actualización descargada',
      message: 'La actualización ha sido descargada y está lista para ser instalada',
      icon: path.join(__dirname, './src/assets/img/tele-trabajo.png'),
      sound: true,
      wait: true
    });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const { percent } = progressObj;
  
    tray.setToolTip(`Descargando actualización... ${percent.toFixed(2)}%`);
 
  });

  autoUpdater.on("error", (info) => {
    console.log(`Error in auto-updater. ${info}`);
    nodeNotifier.notify({
      title: 'Error en la actualización',
      message: `Error durante la actualización: ${info}`,
      icon: path.join(__dirname, './src/assets/img/tele-trabajo.png'),
      sound: true,
      wait: true
    });


  });

  ipcMain.on('close-main-window', () => {
    const mainWindow = getMainWindow();
    const loginWindow = getLoginWindow();
    if (mainWindow) mainWindow.close();
    if (loginWindow) loginWindow.close();
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
    console.log(dateLocal);
    const endLocalWork = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    console.log(endLocalWork);
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
    console.time('----------------------CLOSE APP----------------------');
    
    app.quit();

    console.timeEnd('----------------------CLOSE APP----------------------');
  });

  ipcMain.on('close-modal-window', () => {
    const modalWindows = getModalWindow();
    if (modalWindows) modalWindows.close();
  });

  ipcMain.on('pause-timer', () => {
    stopCronJobs();
    pauseNotification();
    createModalWindow();
    getModalWindow().webContents.send('timer-event');
  })
  
  ipcMain.on('resume-timer', () => {
    setupCronJobs();
    resumeNotification();
    createModalWindow();
    getModalWindow().webContents.send('timer-event');
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

  ipcMain.on('update-work-day-front', async (event, data) => {
    const store = await getStore();
    const { uid } = await getCredentials(['uid']);
    const work_day = store.set(`work-day-${uid}`, data);
    console.log('Datos actualizados:', store.get('work-day'));

    // // // BrowserWindow.getAllWindows().forEach(win => {
    // // //   win.webContents.send('work-day-updated', work_day);
    // // // });
  });

  ipcMain.on('send-manual-data', async (event, manualData) => {
    
    console.time('----------------------MANUAL DATA----------------------')
    console.time('------------------SENT INFO----------------------------')
    // // // const odoo_ids = await checkDataAndSend(manualData);
    // // // const odoo_id = await sendActivityUserSummary();
    
    const [odoo_ids, odoo_id] = await Promise.all([  
      await checkDataAndSend(manualData),
      await sendActivityUserSummary()
    ]);
    console.timeEnd('------------------SENT INFO----------------------------')
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
    // // // console.time('-----------------GET USER ACTIVITY-----------------')
    // // //   const userActivityData = await getUserActivity();
    // // //   console.log(userActivityData);
    // // //   console.timeEnd('-----------------GET USER ACTIVITY-----------------')
    BrowserWindow.getAllWindows().forEach(win => {
        
      win.webContents.send('info-send', {
        message: {
          'activity data send': odoo_ids,
          'summary data send': odoo_id,
        }
        
      });
    });
    event.reply('send-manual-data-response');
    console.timeEnd('----------------------MANUAL DATA----------------------')
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('work-day-updated', work_day);
    });

    
  });
  //ENVIAR INFO DE ACTIVIDAD
  ipcMain.on('send-data', async (event, client, description, task, pause) => {
    try {
      const store = await getStore();
      const modalWindows = createModalWindow();
      modalWindows.show();
      console.log('Datos recibidos del formulario:', { client, description, task , pause });
      const { uid } = await getCredentials(['uid']);
      // Asignación de datos a `activityData`
      activityData.partner_id = client;
      activityData.description = description;
      activityData.task_id = task;
      activityData.pause_id = pause;
  
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
      // // // BrowserWindow.getAllWindows().forEach(win => {
      // // //   win.webContents.send('work-day-updated', work_day);
      // // // });
  
      
      
      console.timeEnd('prepareDatd')
      // const odoo_id = await checkDataAndSend(activityData);
      console.time("Total Execution");


      const [activityDataLog, summaryDataLog] = await Promise.all([
        checkDataAndSend(activityData),
        sendActivityUserSummary(),
      ]);

      console.time('-----------------GET USER ACTIVITY-----------------')
      const userActivityData = await getUserActivity();
      store.set(`data-user-${uid}`, userActivityData);
      console.log(userActivityData);
      console.timeEnd('-----------------GET USER ACTIVITY-----------------')
      
      console.timeEnd("Total Execution");
      
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

      event.reply('send-data-response');
      //CERRAR MODAL HASTA DESPUES DE ENVIAR LA INFO
      modalWindows.close();



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

  ipcMain.handle('get-clients-and-pauses', async (event) => {
    const store = await getStore();
    const clients = store.get('clients') || [];
    const pauses = store.get('pauses') || [];
    return {clients, pauses};
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