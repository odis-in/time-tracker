const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const { authenticateUser, login, checkSession, logout } = require('./src/odoo/authenticateUser');
const { presenceNotification } = require('./src/utils/presenceNotification');
const cron = require('node-cron');
const path = require('path');
const { captureScreen } = require('./src/utils/captureScreen');

let tray;
let mainWindow;
let loginWindow;
let presenceJob;
let screenshotJob;

const activityData = {
  presence: null,
  screenshot: null,
};

function createLoginWindow() {
  if (loginWindow) {
    loginWindow.show();
    return;
  }

  loginWindow = new BrowserWindow({
    width: 700,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    frame: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    transparent: true,
    backgroundColor: '#00000000',
  });

  loginWindow.loadFile('./src/pages/login.html');

  loginWindow.on('minimize', (event) => {
    event.preventDefault();
    loginWindow.hide();
  });

  loginWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      loginWindow.hide();
    }
  });

  loginWindow.on('closed', () => {
    loginWindow = null;
  });
}

function createMainWindow() {
  if (mainWindow) {
    mainWindow.show();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 700,
    height: 450,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
    },
    frame: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    transparent: true,
    backgroundColor: '#00000000',
  });

  mainWindow.loadFile('./src/pages/index.html');

  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  tray = new Tray(path.join(__dirname, './src/assets/img/tele-trabajo.png'));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Mostrar',
      click: () => {
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
  // Notificación de presencia cada minuto
  presenceJob = cron.schedule('*/1 * * * *', () => {
    presenceNotification(activityData);
  });

  // Captura de pantalla cada minuto
  screenshotJob = cron.schedule('*/1 * * * *', () => {
    captureScreen(activityData)
  });
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
  createLoginWindow();
  createTray();

  ipcMain.handle('login', async (event, username, password) => {
    try {
      const uid = await authenticateUser(username, password);
      return uid;
    } catch (error) {
      console.error('Error al autenticar con Odoo:', error);
      throw error; // Lanzar error para manejar en el renderer
    }
  });
});

ipcMain.on('close-main-window', () => {
  if (mainWindow) {
    mainWindow.close();
    return;
  }

  if (loginWindow) {
    loginWindow.close();
    return;
  }
});

ipcMain.on('logout', () => {
  if (mainWindow) {
    mainWindow.close();
  }
  stopCronJobs(); // Detiene los trabajos cron
  createLoginWindow(); // Vuelve a abrir la ventana de login
});

ipcMain.on('login-success', () => {
  createMainWindow(); // Muestra la ventana principal
  setupCronJobs(); // Configura los trabajos cron
  if (loginWindow) {
    loginWindow.close(); // Cierra la ventana de login
  }
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (!mainWindow && !loginWindow) {
    createLoginWindow();
  } else if (mainWindow) {
    mainWindow.show();
  } else if (loginWindow) {
    loginWindow.show();
  }
});