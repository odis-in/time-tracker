const xmlrpc = require('xmlrpc');
// const { db } = require('./config');
const { getCredentials } = require('../utils/crendentialManager');

async function sendData(modelName, activityData) {
    try {
        const { username, password, uid , url, db } = await getCredentials(['username', 'password', 'uid', 'url','db']);

        if (!username || !password || !uid || !url) {
            throw new Error('Credenciales no encontradas. Por favor, autentique nuevamente.');
        }

        const models = xmlrpc.createClient({ url: `${url}/xmlrpc/2/object` });

        activityData.user_id = uid;

        models.methodCall('execute_kw', [db, uid, password, modelName, 'create', [activityData]], (err, result) => {
            if (err) {
                console.error('Error al crear el registro en Odoo:', err);
                return;
            }
            console.log(`Registro creado con ID: ${result}`);
        });
    } catch (error) {
        console.error('Error al enviar datos a Odoo:', error);
    }
}


async function sendDataSummary(modelName, activityData) {
    try {
        const { username, password, uid , url, db } = await getCredentials(['username', 'password', 'uid', 'url','db']);

        if (!username || !password || !uid || !url) {
            throw new Error('Credenciales no encontradas. Por favor, autentique nuevamente.');
        }

        const models = xmlrpc.createClient({ url: `${url}/xmlrpc/2/object` });

        const dataSummary = activityData.map((data) => { 
            return {
                ...data,
                user_id: uid,
            }
        });

        models.methodCall('execute_kw', [db, uid, password, modelName, 'create', [dataSummary]], (err, result) => {
            if (err) {
                console.error('Error al crear el registro en Odoo:', err);
                return;
            }
            console.log(`Registro creado con ID: ${result}`);
        });
    } catch (error) {
        console.error('Error al enviar datos a Odoo:', error);
    }
}

module.exports = {
    sendData, sendDataSummary
};
