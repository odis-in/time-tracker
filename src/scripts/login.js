const { ipcRenderer } = require('electron');

document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  document.getElementById('error-message').textContent = '';
  const svgElement = document.getElementById('svg-loading'); 
  const buttonText = document.getElementById('button-text');
  if (svgElement) { 
    svgElement.classList.add('loading'); 
    svgElement.classList.remove('no-loading');
    buttonText.style.display = 'none';
  } 
  
  

  
  const formData = new FormData(event.target);
  const username = formData.get('username');
  const password = formData.get('password');
  const url = formData.get('url');
  const db = formData.get('db');
  // const timeNotification = formData.get('time-notification');

  try {
    const {uid , name, imageBase64 } = await ipcRenderer.invoke('login', username, password, url, db);
    
    if (uid) {
      localStorage.setItem('name', name);
      localStorage.setItem('imageBase64', imageBase64);
      localStorage.setItem('username', username);
      localStorage.setItem('password', password);
      localStorage.setItem('url',url);
      localStorage.setItem('db',db);
      localStorage.setItem('uid',uid);
      // localStorage.setItem('timeNotification',timeNotification);

      ipcRenderer.send('login-success');
      document.getElementById('error-message').textContent = '';
      // event.target.reset(); limpiar formulario
      document.getElementById('username').focus();
      svgElement.classList.add('no-loading')
      svgElement.classList.remove('loading')
      buttonText.style.display = 'block';
    }
   
  } catch (error) {
    document.getElementById('error-message').textContent = 'Usuario o contraseña incorrectos';
    document.getElementById('username').focus();
    svgElement.classList.add('no-loading')
    svgElement.classList.remove('loading')
    buttonText.style.display = 'block';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const closeButton = document.getElementById('close');
  const minimmizeButton = document.getElementById('minimize');
  minimmizeButton.addEventListener('click', () => {
    ipcRenderer.send('minimize-login-window');
  });

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
