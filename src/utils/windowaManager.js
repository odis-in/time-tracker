const { app, BrowserWindow } = require('electron');
const path = require('path');

let loginWindow;
let mainWindow;
let modalWindow;

function createLoginWindow() {
  if (loginWindow) {
    loginWindow.show();
    return loginWindow; 
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
    width: 800,
    height: 600,
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

function createModalWindow() {
  if (modalWindow) {
    modalWindow.show();
    return modalWindow;
  }

  modalWindow = new BrowserWindow({
    parent: mainWindow,
    // modal: true,
    // show: false,
    width: 400,
    height: 300,
    // resizable: false,
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

  modalWindow.loadFile('./src/pages/modal.html');

  modalWindow.on('minimize', (event) => {
    event.preventDefault();
    modalWindow.hide();
  });

  modalWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      modalWindow.hide();
    }
  });

  modalWindow.on('closed', () => {
    modalWindow = null;
  });

  

  return modalWindow;
}

function getLoginWindow() {
  return loginWindow;
}

function getMainWindow() {
  return mainWindow;
}

function getModalWindow() {
  return modalWindow;
}

module.exports = { createLoginWindow, createMainWindow, getLoginWindow, getMainWindow , createModalWindow, getModalWindow};
