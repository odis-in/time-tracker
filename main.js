const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const { authenticateUser, login, checkSession, logout } = require('./odoo/authenticateUser');
const notifier = require('node-notifier');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const screenshot = require('desktop-screenshot');
const { sendDataToOdoo } = require('./odoo/sendDataToOdoo ');
const { Buffer } = require('buffer'); 

let tray;
let mainWindow;
let loginWindow;
let presenceJob;
let screenshotJob;

// Objeto para almacenar datos de presencia y captura de pantalla
const activityData = {
  presence: null,
  screenshot: null,
};

// Enviar datos combinados a Odoo
async function sendCombinedDataToOdoo(username, password, modelName) {
  if (activityData.presence.timestamp && activityData.screenshot) {
    try {
      await sendDataToOdoo(
        username,
        password,
        modelName,
        {
          timestamp: activityData.presence.timestamp,
          presence_status: activityData.presence.status,
          screenshot: activityData.screenshot.path,
        }
      );
      // Limpiar datos después de enviar
      activityData.presence = null;
      activityData.screenshot = null;
    } catch (error) {
      console.error('Error al enviar datos combinados a Odoo:', error);
    }
  }
}

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
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
      
        const formattedTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        console.log(`Presencia confirmada a las: ${formattedTime}`);
        activityData.presence = {
          status: 'active',
          timestamp: formattedTime
        }
        setTimeout(() => sendCombinedDataToOdoo('admin', 'gui0d00#*', 'user.activity'), 1000);
       
      } else {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');

        const formattedTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        activityData.presence = {
          status: 'inactive',
          timestamp: formattedTime
        }
        setTimeout(() => sendCombinedDataToOdoo('admin', 'gui0d00#*', 'user.activity'), 1000);
        console.log(`No se recibió respuesta del usuario a las: ${formattedTime}`);
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

    fs.readFile(filePath, (readErr, data) => {
      if(readErr){
        console.error('Error al leer el archivo:', readErr);
        return;
      }
      //convertir base64 
      const base64Data = Buffer.from(data).toString('base64');
      activityData.screenshot = {path: base64Data};
      console.log('Captura de pantalla en base64 lista para enviar a odoo');
    })
    console.log('Captura de pantalla guardada en:', filePath);
    activityData.screenshot = {
      path: filePath,
    }

    setTimeout(() => sendCombinedDataToOdoo('admin', 'gui0d00#*', 'user.activity'), 1000);
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

  ipcMain.handle('login', async (event, username, password) => {
    try {
      const uid = await authenticateUser(username, password);
      return uid;
    } catch (error) {
      console.error('Error al autenticar con Odoo:', error);
      throw error; // Lanzar error para manejar en el renderer
    }
  });

  ipcMain.on('send-activity-data', async (event, username, password, modelName, activityData) => {
    try {
      await sendDataToOdoo(username, password, modelName, activityData);
    } catch (error) {
      console.error('Error al enviar datos a Odoo:', error);
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