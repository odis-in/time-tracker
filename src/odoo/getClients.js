const xmlrpc = require('xmlrpc');
const { getCredentials } = require('../utils/crendentialManager');

async function getClients() {
    try {
        const { username, password, uid, url, db } = await getCredentials(['username', 'password', 'uid', 'url', 'db']);

        if (!username || !password || !uid || !url) {
            throw new Error('Credenciales no encontradas. Por favor, autentique nuevamente.');
        }

        const models = xmlrpc.createClient({ url: `${url}/xmlrpc/2/object` });

        // Envolver el método `methodCall` en una promesa
        return new Promise((resolve, reject) => {
            models.methodCall(
                'execute_kw',
                [db, uid, password, 'res.partner', 'search_read', [[['customer_rank', '>', 0]], ['name']]],
                (err, result) => {
                    if (err) {
                        console.error('Error al obtener los clientes de Odoo:', err);
                        reject(err); // Rechazar la promesa en caso de error
                        return;
                    }
                    resolve(result); // Resolver la promesa con el resultado
                }
            );
        });
    } catch (error) {
        console.error('Error al consultar datos a Odoo:', error);
        throw error; // Lanza el error para que sea manejado donde se llame esta función
    }
}

module.exports = {
    getClients,
};
