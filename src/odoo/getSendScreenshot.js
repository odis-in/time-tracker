const xmlrpc = require('xmlrpc');
const { getCredentials } = require('../utils/crendentialManager');

async function getSendScreenshot() {
    try {
        const { username, password, uid, url, db } = await getCredentials(['username', 'password', 'uid', 'url', 'db']);

        if (!username || !password || !uid || !url || !db) {
            throw new Error('Credenciales no encontradas. Por favor, autentique nuevamente.');
        }


        let models
        if (url.includes('https://')) {
            models = xmlrpc.createSecureClient({ url: `${url}/xmlrpc/2/object` });
        } else {
            models = xmlrpc.createClient({ url: `${url}/xmlrpc/2/object` });
        }


        const timeNotification = await new Promise((resolve, reject) => {
            models.methodCall(
                'execute_kw',
                [db, uid, password, 'res.users', 'search_read', [[['id', '=', uid]], ['send_screenshot']]],
                (err, result) => {
                    if (err) {
                        console.error('Error al obtener send_screenshot en Odoo:', err);
                        reject(err);
                        return;
                    }
                    resolve(result[0].send_screenshot);
                }
            );
        });

        return timeNotification;

    } catch (error) {
        console.error('Error al consultar send_screenshot en Odoo:', error);
        return null;
    }
}

module.exports = {
    getSendScreenshot,
};
