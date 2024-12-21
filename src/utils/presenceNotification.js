const notifier = require('node-notifier');
const { checkDataAndSend } = require('./checkDataAndSend');
const { createModalWindow } = require('./windowaManager');
// const {  createModalWindow, getModalWindow } = require('./src/utils/windowaManager');

function getFormattedTimestamp() {
	const now = new Date();
	return now.toISOString().replace('T', ' ').substring(0, 19);
}

function presenceNotification(activityData) {
	notifier.notify(
		{
			title: 'Confiar Prencencia de Presencia',
			message: 'Por favor, confirma tu presencia.',
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

			if (metadata.activationType === 'clicked' || metadata.activationType === 'dismissed') {
				
				createModalWindow();
				
				activityData.presence = { status: 'active', timestamp: formattedTime };
				
			} else {
				activityData.presence = { status: 'inactive', timestamp: formattedTime };
				
			}
		}
	);
}

module.exports = { presenceNotification };