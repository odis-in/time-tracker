const { app, Tray, Menu, ipcMain } = require('electron');
const { authenticateUser } = require('./src/odoo/authenticateUser');
const { presenceNotification } = require('./src/utils/presenceNotification');
const cron = require('node-cron');
const path = require('path');
const { captureScreen } = require('./src/utils/captureScreen');
const { saveCredentials, getCredentials, clearCredentials } = require('./src/utils/crendentialManager');
const { createLoginWindow, createMainWindow, getLoginWindow, getMainWindow } = require('./src/utils/windowaManager');

let tray;
let presenceJob;
let screenshotJob;

const activityData = {
  presence: null,
  screenshot: null,
};

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
          createLoginWindow(); // Si no hay ventana visible, crea la de login.
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

function setupCronJobs() {
  presenceJob = cron.schedule('*/1 * * * *', () => {
    presenceNotification(activityData);
  });

  screenshotJob = cron.schedule('*/1 * * * *', () => {
    captureScreen(activityData);
  });
}

async function verifyCredentialsOnStart() {
  try {
    const { username, password } = await getCredentials();
    if (username && password) {
      const uid = await authenticateUser(username, password);
      if (uid) {
        createMainWindow();
        setupCronJobs();
      } else {
        createLoginWindow();
      }
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

  ipcMain.handle('login', async (event, username, password) => {
    try {
      const uid = await authenticateUser(username, password);
      await saveCredentials(username, password, uid.toString());
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