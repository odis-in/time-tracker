const nodeNotifier = require('node-notifier');
const { checkDataAndSend } = require('./checkDataAndSend');
const { createModalWindow } = require('./windowaManager');
const path = require('path');
// const {  createModalWindow, getModalWindow } = require('./src/utils/windowaManager');

function getFormattedTimestamp() {
	const now = new Date();
	return now.toISOString().replace('T', ' ').substring(0, 19);
}

function presenceNotification(activityData) {
	nodeNotifier.notify(
		{
			appID: 'com.electron-project',
			title: 'Confirmar presencia',
			message: 'Click aqui para confirmar tu presencia',
			icon: path.join(__dirname, '../assets/img/timer-ticker-ico.png'),
			sound: true,
			wait: true,
			reply: true,
		},
		(err, response, metadata) => {
			if (err) {
				console.error('Error al mostrar la notificación:', err);
				return;
			}
			
			const formattedTime = getFormattedTimestamp();
			
			if (response!='timeout') {
				
				createModalWindow();
				
				// activityData.presence = { status: 'active', timestamp: formattedTime };
			} else {
				
				activityData.presence = { status: 'inactive', timestamp: formattedTime };
				checkDataAndSend(activityData)
			}
		}
	);
}

module.exports = { presenceNotification };