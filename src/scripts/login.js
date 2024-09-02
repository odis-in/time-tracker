const { ipcRenderer } = require('electron');

document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  try {

    const uid = await ipcRenderer.invoke('login', username, password);

    if (uid) {
      ipcRenderer.send('login-success');
      document.getElementById('error-message').textContent = '';
      document.getElementById('username').value = '';
      document.getElementById('password').value = ''; 
      document.getElementById('username').focus();
    }
  } catch (error) {
    document.getElementById('error-message').textContent = 'Usuario o contraseña incorrectos';
    document.getElementById('username').focus();
  }
});

// Manejar el cierre de la ventana
document.addEventListener('DOMContentLoaded', () => {
  const closeButton = document.getElementById('close');
  closeButton.addEventListener('click', () => {
    ipcRenderer.send('close-main-window');
  });
});
