const xmlrpc = require('xmlrpc');
const { getCredentials } = require('../utils/crendentialManager');

async function getDataPause() {
    try {
        const { username, password, uid, url, db } = await getCredentials(['username', 'password', 'uid', 'url', 'db']);
        console.log('username', username, 'password', password, 'uid', uid, 'url', url, 'db', db);
        if (!username || !password || !uid || !url || !db) {
            throw new Error('Credenciales no encontradas. Por favor, autentique nuevamente.');
        }


        let models
        if (url.includes('https://')) {
            models = xmlrpc.createSecureClient({ url: `${url}/xmlrpc/2/object` });
        } else {
            models = xmlrpc.createClient({ url: `${url}/xmlrpc/2/object` });
        }


        const dataPuase = await new Promise((resolve, reject) => {
            models.methodCall(
                'execute_kw',
                [db, uid, password, 'user.activity.pause', 'search_read', [[], ['name']]],
                (err, result) => {
                    if (err) {
                        console.error('Error al obtener pausas en Odoo:', err);
                        reject(err);
                        return;
                    }

                    resolve(result);
                }
            );
        });

        return dataPuase;

    } catch (error) {
        console.error('Error al consultar send_screenshot en Odoo:', error);
        return null;
    }
}

module.exports = {
    getDataPause,
};
