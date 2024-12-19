const { ipcRenderer } = require('electron');

document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(event.target);
  const username = formData.get('username');
  const password = formData.get('password');
  const url = formData.get('url');
  const db = formData.get('db');
  const timeNotification = formData.get('time-notification');

  try {
    const uid = await ipcRenderer.invoke('login', username, password, url, timeNotification, db);

    if (uid) {

      localStorage.setItem('username', username);
      localStorage.setItem('password', password);
      localStorage.setItem('url',url);
      localStorage.setItem('db',db);
      localStorage.setItem('timeNotification',timeNotification);

      ipcRenderer.send('login-success');
      document.getElementById('error-message').textContent = '';
      // event.target.reset(); limpiar formulario
      document.getElementById('username').focus();
    }
  } catch (error) {
    document.getElementById('error-message').textContent = 'Usuario o contraseña incorrectos';
    document.getElementById('username').focus();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const closeButton = document.getElementById('close');
  closeButton.addEventListener('click', () => {
    ipcRenderer.send('close-main-window');
  });
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const dbInput = document.getElementById('db');
  const urlInput = document.getElementById('url');

  if (urlInput && dbInput && usernameInput && passwordInput) {
    usernameInput.value = localStorage.getItem('username');
    passwordInput.value = localStorage.getItem('password');
    dbInput.value = localStorage.getItem('db'); 
    urlInput.value = localStorage.getItem('url');
  }
});
