const notifier = require('node-notifier');
const { checkDataAndSend } = require('./checkDataAndSend');

function getFormattedTimestamp() {
	const now = new Date();
	return now.toISOString().replace('T', ' ').substring(0, 19);
}

function presenceNotification(activityData) {
	notifier.notify(
		{
			title: 'Prueba de Presencia',
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
				console.log(`Presencia confirmada a las: ${formattedTime}`);
				activityData.presence = { status: 'active', timestamp: formattedTime };
				setTimeout(() => checkDataAndSend(activityData), 1000);
			} else {
				console.log(`No se recibió respuesta del usuario a las: ${formattedTime}`);
				activityData.presence = { status: 'inactive', timestamp: formattedTime };
				setTimeout(() => checkDataAndSend(activityData), 1000);
			}
		}
	);
}

module.exports = { presenceNotification };