const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const notifier = require('node-notifier');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const screenshot = require('desktop-screenshot');

let tray;
let mainWindow;
let loginWindow;
let presenceJob; 
let screenshotJob; 

function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 700,
    height: 600,
    webPreferences: {
      // preload: path.join(__dirname, './src/scripts/login.js'),
      nodeIntegration: true,
      contextIsolation: false,
    },
    frame: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    transparent: true,
    backgroundColor: '#00000000'
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
    return false;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 700,
    height: 450,
    webPreferences: {
      // preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
    },
    frame: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    transparent: true,
    backgroundColor: '#00000000'
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
    return false;
  });
}

function createTray() {
  tray = new Tray(path.join(__dirname, './src/assets/img/tele-trabajo.png'));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Mostrar',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
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

function showPresenceNotification() {
  notifier.notify(
    {
      title: 'Prueba de Presencia',
      message: 'Por favor, confirma tu presencia.',
      sound: true,
      wait: true,
      reply: true
    },
    (err, response, metadata) => {
      if (err) {
        console.error('Error al mostrar la notificación:', err);
        return;
      }

      console.log('Metadata:', metadata);

      if (metadata.activationType === 'clicked' || metadata.activationType === 'dismissed') {
        const checkTime = new Date().toString();
        console.log(`Presencia confirmada a las: ${checkTime}`);
      } else {
        console.log('No se recibió respuesta del usuario.');
      }
    }
  );
}

function captureScreenAndSave() {
  const desktopPath = path.join(require('os').homedir(), 'Desktop', 'capturas');

  if (!fs.existsSync(desktopPath)) {
    fs.mkdirSync(desktopPath, { recursive: true });
  }

  const filePath = path.join(desktopPath, `screenshot_${Date.now()}.png`);

  screenshot(filePath, (err) => {
    if (err) {
      console.error('Error al capturar la pantalla:', err);
      return;
    }
    console.log('Captura de pantalla guardada en:', filePath);
  });
}

function setupCronJobs() {
  // Notificación de presencia cada minuto
  presenceJob = cron.schedule('*/1 * * * *', () => {
    showPresenceNotification();
  });

  // Captura de pantalla cada minuto
  screenshotJob = cron.schedule('*/1 * * * *', () => {
    captureScreenAndSave();
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

  ipcMain.on('close-main-window', () => {
    if (mainWindow) {
      mainWindow.close();
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
    createWindow();
    setupCronJobs(); // Configura los trabajos cron
    if (loginWindow) {
      loginWindow.close();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
