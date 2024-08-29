const { app, BrowserWindow, Tray, Menu } = require('electron');
const notifier = require('node-notifier');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const screenshot = require('desktop-screenshot');

let tray;
let mainWindow;

// Crea la ventana de la aplicación
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    frame: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
  });

  mainWindow.loadFile('login.html');

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
  // Crea un ícono en la bandeja del sistema
  tray = new Tray(path.join(__dirname, 'tele-trabajo.png'));

  // Crea un menú contextual para el ícono
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

  // Configura el ícono y el menú contextual
  tray.setToolTip('Mi Aplicación Electron');
  tray.setContextMenu(contextMenu);
}

// Mostrar notificación de presencia
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
        console.log('No se recibio respuesta del usuario.');
      }
    }
  );
}

// Capturar pantalla y guardar en el escritorio
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

// Configurar tareas recurrentes
function setupCronJobs() {
  // Notificación de presencia cada 5 minutos
  cron.schedule('*/1 * * * *', () => {
    showPresenceNotification();
  });

  // Captura de pantalla cada 5 minutos
  cron.schedule('*/1 * * * *', () => {
    captureScreenAndSave();
  });
}

// Eventos de Electron
app.whenReady().then(() => {
  createWindow();
  setupCronJobs();
  createTray();
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
