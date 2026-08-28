async function getNotifications(sessionId, url) {
  const endpoint = `${url.replace(/\/$/, '')}/web/get_notifications/`;
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Cookie: sessionId,
    },
  });

  if (!response.ok) {
    throw new Error(`Odoo rechazó la consulta de notificaciones (${response.status})`);
  }

  const notifications = await response.json();
  if (!Array.isArray(notifications)) {
    throw new Error('Odoo devolvió un formato de notificaciones inválido');
  }

  return notifications;
}

module.exports = { getNotifications };
