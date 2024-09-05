const { ipcRenderer } = require('electron');

document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(event.target);
  const username = formData.get('username');
  const password = formData.get('password');
  const url = formData.get('url');
  const timeNotification = formData.get('time-notification');

  try {
    const uid = await ipcRenderer.invoke('login', username, password, url, timeNotification);

    if (uid) {
      ipcRenderer.send('login-success');
      document.getElementById('error-message').textContent = '';
      event.target.reset();
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
});
