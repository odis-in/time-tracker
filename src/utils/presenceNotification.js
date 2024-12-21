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
				console.log('prueba modal desde la notificacion -------------------------->');
				createModalWindow();
				console.log(`Presencia confirmada a las: ${formattedTime}`);
				activityData.presence = { status: 'active', timestamp: formattedTime };
				// if (activityData.partner_id) {
				// 	console.log('prueba desde la notificacion con el modal -------------------------->',activityData);
				// 	checkDataAndSend(activityData)
				// }
			} else {
				console.log(`No se recibió respuesta del usuario a las: ${formattedTime}`);
				activityData.presence = { status: 'inactive', timestamp: formattedTime };
				console.log('prueba desde la inactividad -------------------------->',activityData);
				//partner_id, description = null , status = inactive
				checkDataAndSend(activityData)
			}
		}
	);
}

module.exports = { presenceNotification };