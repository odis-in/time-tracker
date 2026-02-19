const nodeNotifier = require('node-notifier');
const { app, Notification } = require('electron');
const { checkDataAndSend } = require('./checkDataAndSend');
const { createModalWindow } = require('./windowaManager');
const path = require('path');
// const {  createModalWindow, getModalWindow } = require('./src/utils/windowaManager');

const isMac = process.platform === 'darwin';
const MAC_NOTIFICATION_TIMEOUT_SECONDS = 60;
const MAC_FALLBACK_TIMEOUT_MS = (MAC_NOTIFICATION_TIMEOUT_SECONDS + 5) * 1000;
const MAC_RESPONSE_WINDOW_MS = MAC_NOTIFICATION_TIMEOUT_SECONDS * 1000;

function getFormattedTimestamp() {
	const now = new Date();
	return now.toISOString().replace('T', ' ').substring(0, 19);
}

function getNotificationOptions() {
	const baseOptions = {
		appID: 'com.electron-project',
		title: 'Confirmar presencia',
		message: 'Click aqui para confirmar tu presencia',
		icon: path.join(__dirname, '../assets/img/timer-ticker-ico.png'),
		sound: true,
		reply: false,
	};

	if (!isMac) {
		return {
			...baseOptions,
			wait: true,
		};
	}

	// macOS Notification Center uses `timeout` (seconds). `wait: true` maps to 5s.
	// We set 60s explicitly so users can see/interact with the notification longer.
	return {
		...baseOptions,
		timeout: MAC_NOTIFICATION_TIMEOUT_SECONDS,
		wait: false,
	};
}

function presenceNotification(activityData) {
	const notificationOptions = getNotificationOptions();
	let handled = false;
	let bounceId = -1;
	let fallbackTimer = null;

	const finalizeAsInactive = () => {
		if (handled) return;
		handled = true;
		if (fallbackTimer) {
			clearTimeout(fallbackTimer);
			fallbackTimer = null;
		}
		if (isMac && bounceId !== -1) {
			app.dock.cancelBounce(bounceId);
		}
		const formattedTime = getFormattedTimestamp();
		activityData.presence = { status: 'inactive', timestamp: formattedTime };
		checkDataAndSend(activityData);
	};

	const finalizeAsActive = () => {
		if (handled) return;
		handled = true;
		if (fallbackTimer) {
			clearTimeout(fallbackTimer);
			fallbackTimer = null;
		}
		if (isMac && bounceId !== -1) {
			app.dock.cancelBounce(bounceId);
		}
		createModalWindow();
	};

	// In some macOS setups callback events may not fire reliably; this avoids hanging state.
	if (isMac) {
		// Keep attention even if banner disappears quickly.
		bounceId = app.dock.bounce('informational');
		fallbackTimer = setTimeout(() => {
			finalizeAsInactive();
		}, MAC_FALLBACK_TIMEOUT_MS);

		if (!Notification.isSupported()) {
			finalizeAsInactive();
			return;
		}

		const macNotification = new Notification({
			title: 'Confirmar presencia',
			body: 'Click aqui para confirmar tu presencia',
			icon: path.join(__dirname, '../assets/img/timer-ticker-ico.png'),
			silent: false,
		});

		macNotification.on('click', () => {
			finalizeAsActive();
			macNotification.close();
		});

		macNotification.show();

		// User has at most 60s to respond, independent of macOS visual style.
		setTimeout(() => {
			if (handled) return;
			macNotification.close();
			finalizeAsInactive();
		}, MAC_RESPONSE_WINDOW_MS);

		return;
	}

	nodeNotifier.notify(
		notificationOptions,
		(err, response, metadata) => {
			if (err) {
				console.error('Error al mostrar la notificación:', err);
				finalizeAsInactive();
				return;
			}

			const responseText = String(response || '').toLowerCase();
			const activationType = String(metadata?.activationType || '').toLowerCase();
			const clicked = responseText === 'activate' || activationType === 'contents_clicked';

			if (clicked) {
				finalizeAsActive();
				return;
			}

			finalizeAsInactive();
		}
	);
}

module.exports = { presenceNotification };
