const { ipcRenderer } = require('electron');

document.getElementById('loginForm').addEventListener('submit', (event) => {
  event.preventDefault();

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  // Validación simple de usuario y contraseña con datos de ejemplo
  if (username === 'admin' && password === '1234') {
    ipcRenderer.send('login-success'); // Envía un mensaje al proceso principal
  } else {
    alert('Usuario o contraseña incorrectos'); // Muestra un mensaje de error
  }
});