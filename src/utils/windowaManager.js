const { app, BrowserWindow } = require('electron');
const path = require('path');

let loginWindow;
let mainWindow;

function createLoginWindow() {
  if (loginWindow) {
    loginWindow.show();
    return loginWindow;  // Retorna la ventana para referencia.
  }

  loginWindow = new BrowserWindow({
    width: 700,
    height: 650,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
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

  return loginWindow;
}

function createMainWindow() {
  if (mainWindow) {
    mainWindow.show();
    return mainWindow;  // Retorna la ventana para referencia.
  }

  mainWindow = new BrowserWindow({
    width: 700,
    height: 450,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
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

  // mainWindow.webContents.openDevTools();

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

  return mainWindow;
}

function getLoginWindow() {
  return loginWindow;
}

function getMainWindow() {
  return mainWindow;
}

module.exports = { createLoginWindow, createMainWindow, getLoginWindow, getMainWindow };
