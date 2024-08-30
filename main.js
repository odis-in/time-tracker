const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const notifier = require('node-notifier');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const screenshot = require('desktop-screenshot');

let tray;
let mainWindow;
let loginWindow;

function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 700,
    height: 600,
    webPreferences: {
      // preload: path.join(__dirname, './src/scripts/login.js'),
      nodeIntegration: true,
      contextIsolation: false,
    },
    frame: false, // Sin marco
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    transparent: true, // Hacer que el fondo sea transparente
    backgroundColor: '#00000000' // Fondo transparente
  });

  loginWindow.loadFile('./src/pages/login.html');

  // Evento cuando la ventana está minimizada
  loginWindow.on('minimize', (event) => {
    event.preventDefault();
    loginWindow.hide(); // Oculta la ventana en lugar de minimizarla
  });

  // Evento cuando se cierra la ventana
  loginWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      loginWindow.hide(); // Oculta la ventana en lugar de cerrarla
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
    frame: false, // Sin marco
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    transparent: true, // Hacer que el fondo sea transparente
    backgroundColor: '#00000000' // Fondo transparente
  });

  mainWindow.loadFile('./src/pages/index.html');

  // Evento cuando la ventana está minimizada
  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    mainWindow.hide(); // Oculta la ventana en lugar de minimizarla
  });

  // Evento cuando se cierra la ventana
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide(); // Oculta la ventana en lugar de cerrarla
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
        // Aquí podrías enviar el checkTime a un servidor si fuera necesario
      } else {
        console.log('No se recibió respuesta del usuario.');
      }
    }
  );
}

function captureScreenAndSave() {
  const desktopPath = path.join(require('os').homedir(), 'Desktop', 'capturas');

  // Crear la carpeta si no existe
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
    // Aquí podrías enviar al servidor si fuera necesario
  });
}

function setupCronJobs() {
  // Notificación de presencia cada minuto
  cron.schedule('*/1 * * * *', () => {
    showPresenceNotification();
  });

  // Captura de pantalla cada minuto
  cron.schedule('*/1 * * * *', () => {
    captureScreenAndSave();
  });
}

app.whenReady().then(() => {
  createLoginWindow();
  createTray();

  ipcMain.on('close-main-window', () => {
    if (loginWindow) {
      loginWindow.close(); 
    } 
  });
});

ipcMain.on('close-main-window', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

ipcMain.on('logout', () => {
  if (mainWindow) {
    mainWindow.close(); // Cierra la ventana principal
  }
  createLoginWindow(); // Vuelve a abrir la ventana de login
});


ipcMain.on('login-success', () => {
  createWindow();
  setupCronJobs();
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
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});