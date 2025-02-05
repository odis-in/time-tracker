const xmlrpc = require('xmlrpc');
const { getCredentials } = require('../utils/crendentialManager');

async function deleteData(start_time, end_time, partner_id) {
    try {
        const { username, password, uid, url, db } = await getCredentials(['username', 'password', 'uid', 'url', 'db']);

        if (!username || !password || !uid || !url) {
            throw new Error('Credenciales no encontradas. Por favor, autentique nuevamente.');
        }

        const models = xmlrpc.createSecureClient({ url: `${url}/xmlrpc/2/object` });
        console.log(end_time.split(' ')[1]);

        let domain;
        if (end_time.split(' ')[1] === '06:00') {
            domain = [['timestamp', '>=', `${start_time}:00`], ['partner_id', '=', parseInt(partner_id)]];
        } else {
            domain = [['timestamp', '>=', `${start_time}:00`], ['timestamp', '<=', `${end_time}:59`], ['partner_id', '=', parseInt(partner_id)]];
        }

        const searchIds = await new Promise((resolve, reject) => {
            models.methodCall(
                'execute_kw',
                [db, uid, password, 'user.activity', 'search', [domain]],
                (err, result) => {
                    if (err) {
                        console.error('Error al buscar los registros en Odoo:', err);
                        reject(err);
                        return;
                    }
                    resolve(result);
                }
            );
        });

        if (searchIds.length === 0) {
            console.log('No se encontraron registros para eliminar.');
            return;
        }


        await new Promise((resolve, reject) => {
            models.methodCall(
                'execute_kw',
                [db, uid, password, 'user.activity', 'unlink', [searchIds]],
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
