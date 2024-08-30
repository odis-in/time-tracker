const { ipcRenderer } = require('electron');

document.getElementById('loginForm').addEventListener('submit', (event) => {
  event.preventDefault();

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  if (username === 'admin' && password === '1234') {
    ipcRenderer.send('login-success'); // Envía un mensaje al proceso principal
    // Limpiar mensaje de error
    document.getElementById('error-message').textContent = '';
  } else {
    // Mostrar mensaje de error
    document.getElementById('error-message').textContent = 'Usuario o contraseña incorrectos';
    // Enfocar el campo de usuario
    
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const closeButton = document.getElementById('close');
  closeButton.addEventListener('click', () => {
    ipcRenderer.send('close-main-window'); 
  });
});