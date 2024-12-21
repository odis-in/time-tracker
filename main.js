const { app, Tray, Menu, ipcMain , BrowserWindow } = require('electron');
const { authenticateUser } = require('./src/odoo/authenticateUser');
const { getClients } = require('./src/odoo/getClients');
const { presenceNotification } = require('./src/utils/presenceNotification');
const cron = require('node-cron');
const path = require('path');
const { captureScreen } = require('./src/utils/captureScreen');
const { saveCredentials, getCredentials, clearCredentials } = require('./src/utils/crendentialManager');
const { createLoginWindow, createMainWindow, createModalWindow, getLoginWindow, getMainWindow, getModalWindow } = require('./src/utils/windowaManager');
const { getIpAndLocation } = require('./src/utils/getIPAddress');
const { checkDataAndSend } = require('./src/utils/checkDataAndSend');
async function getStore() {
  const { default: Store } = await import('electron-store');
  return new Store(); 
}
let tray;
let presenceJob = null;
let screenshotJob = null;
let addressJob = null;

const activityData = {
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
          const mainWindow = getMainWindow();
          const loginWindow = getLoginWindow();

          if (mainWindow && mainWindow.isVisible()) {
            mainWindow.focus();
          } else if (loginWindow && loginWindow.isVisible()) {
            loginWindow.focus();
          } else if (mainWindow) {
            mainWindow.show();
          } else if (loginWindow) {
            loginWindow.show();
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

    tray.setToolTip('Mi Aplicación Electron');
    tray.setContextMenu(contextMenu);
  }

  async function setupCronJobs() {
    const { timeNotification } = await getCredentials(['timeNotification']);

    if (!timeNotification) {
      console.log('No se ha definido la hora de notificación');
      return;
    }

    const notifationInterval = parseInt(timeNotification);

    if (presenceJob || screenshotJob || addressJob) {
      console.log("Cron jobs ya están configurados");
      return;
    }

    presenceJob = cron.schedule(`*/${notifationInterval} * * * *`, () => {
      presenceNotification(activityData);
      // console.log('prueba modal -------------------------->',activityData.presence);
      // todo
      // if (activityData.presence === 'active') {
      //   createModalWindow();
      // }
    });

    screenshotJob = cron.schedule(`*/${notifationInterval} * * * *`, () => {
      captureScreen(activityData);
    });

    addressJob = cron.schedule(`*/${notifationInterval} * * * *`, () => {
      getIpAndLocation(activityData)
    });
  }
  
  async function verifyCredentialsOnStart() {
    try {
      const { username, password, url, db } = await getCredentials(['username', 'password', 'url', 'db']);
      console.log(username, password, url, db);
      if (username && password) {
        createMainWindow();
        const clients = await getClients();
        const store = await getStore();
        store.set('clients', clients);
        setupCronJobs();
        console.log(activityData);
      } else {
        createLoginWindow();
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

    ipcMain.handle('login', async (event, username, password, url, timeNotification, db) => {
      try {
        const uid = await authenticateUser(username, password, url, db);
        await saveCredentials(username, password, url, timeNotification, uid.toString(), db);
        const clients = await getClients();
        return uid;
      } catch (error) {
        console.error('Error al autenticar con Odoo:', error);
        throw error;
      }
    });
  });

  ipcMain.on('close-main-window', () => {
    const mainWindow = getMainWindow();
    const loginWindow = getLoginWindow();

    if (mainWindow) mainWindow.close();
    if (loginWindow) loginWindow.close();
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
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  });

  ipcMain.on('send-data', async (event, client, description) => {
    const store = await getStore();
    const modalWindows = getModalWindow();
    console.log('Datos recibidos del formulario:', { client, description });
    // store.delete('work-day');
    // console.log('BORRAR DATOS', store.get('work-day'));
    activityData.partner_id = client;
    activityData.description = description;
    // console.log('prueba desde el send-data -------------------------->',activityData);
    // console.log('prueba desde el send-data -------------------------->',store.delete('data_info'));
    // localStorage.setItem('activityData', JSON.stringify(activityData));
    
    const client_data = store.get('clients').find(rec => rec.id == client);
        if (client_data) {
          console.log('Cliente encontrado:', client_data);
        } else {
          console.log('Cliente no encontrado');
        }
    const work_day = store.get('work-day') || [];
    const data_work_day = {
      client: client_data.name,
      startWork: activityData.presence.timestamp,
    }
    work_day.push(data_work_day);
    store.set('work-day', work_day);

    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('work-day-updated', work_day);
    });
    
    console.log('DATOS ACTUALIZADOS ENVIADOS AL PRECESO DE RENDERIZADP')
    console.log('datos para la actividad diaria de trabajo', store.get('work-day'));
    
    console.log(store.get('work-day'));
    checkDataAndSend(activityData)
    
    activityData.partner_id = null;
    activityData.description = null;
    modalWindows.close()
  });
  

  ipcMain.handle('get-work-day', async (event) => {
    const store = await getStore();
    const work_day = store.get('work-day') || [];
    return work_day;
  });

  ipcMain.on('delete_data', async () => {
    const store = await getStore();
    store.delete('work-day');
    console.log('Datos borrados desde el boton', store.get('work-day'));
  });

  ipcMain.on('login-success', () => {
    createMainWindow();
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