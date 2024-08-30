const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
	const closeButton = document.getElementById('close');
	closeButton.addEventListener('click', () => {
		ipcRenderer.send('close-main-window');
	});
});

document.getElementById('logout').addEventListener('click', () => {
	ipcRenderer.send('logout');
});