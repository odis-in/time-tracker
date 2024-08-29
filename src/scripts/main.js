
document.addEventListener('DOMContentLoaded', () => {
	const { ipcRenderer } = require('electron');
	const closeButton = document.getElementById('close');
	closeButton.addEventListener('click', () => {
		ipcRenderer.send('close-main-window'); 
	});
});
