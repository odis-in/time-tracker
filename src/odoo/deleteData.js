const xmlrpc = require('xmlrpc');
const { getCredentials } = require('../utils/crendentialManager');

async function deleteData(odoo_ids, odoo_id) {
    try {
        const { username, password, uid, url, db } = await getCredentials(['username', 'password', 'uid', 'url', 'db']);

        if (!username || !password || !uid || !url) {
            throw new Error('Credenciales no encontradas. Por favor, autentique nuevamente.');
        }
        let models
        if (url.includes('https://')) {
            models = xmlrpc.createSecureClient({ url: `${url}/xmlrpc/2/object` });
        } else {
            models = xmlrpc.createClient({ url: `${url}/xmlrpc/2/object` });
        }
     
        console.log(odoo_ids);

        await new Promise((resolve, reject) => {
            models.methodCall(
                'execute_kw',
                [db, uid, password, 'user.activity', 'unlink', [odoo_ids]],
                (err, result) => {
                    if (err) {
                        console.error('Error al eliminar los registros en Odoo:', err);
                        reject(err);
                        return;
                    }
                    console.log('Registros eliminados exitosamente:', result);
                    resolve(result);
                }
            );
        });


        await new Promise((resolve, reject) => {
            models.methodCall(
                'execute_kw',
                [db, uid, password, 'user.activity.summary', 'unlink', [ [odoo_id] ]],
                (err, result) => {
                    if (err) {
                        console.error('Error al eliminar los registros en Odoo:', err);
                        reject(err);
                        return;
                    }
                    console.log('Registros eliminados exitosamente:', result);
                    resolve(result);
                }
            );
        });

    } catch (error) {
        console.error('Error al consultar datos a Odoo:', error);
    }
}

module.exports = {
    deleteData,
};
