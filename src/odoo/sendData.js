const xmlrpc = require('xmlrpc');
const { authenticateUser } = require('./authenticateUser');
const { url, db } = require('./config');

const models = xmlrpc.createClient({ url: `${url}/xmlrpc/2/object` });

async function sendData(username, password, modelName, activityData) {
    try {
        const uid = await authenticateUser(username, password);

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

module.exports = {
    sendData
};
