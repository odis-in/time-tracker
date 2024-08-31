const xmlrpc = require('xmlrpc');
const { authenticateUser } = require('./authenticateUser');
const { url, db } = require('./config');

// Cliente XML-RPC para operaciones de modelo
const models = xmlrpc.createClient({ url: `${url}/xmlrpc/2/object` });

// Función para enviar datos a Odoo
async function sendDataToOdoo(username, password, modelName, activityData) {
    try {
        // Autenticar al usuario
        const uid = await authenticateUser(username, password);

        console.log(`UID autenticado: ${uid}`);

        // Asignar el uid autenticado a los datos de actividad
        activityData.user_id = uid;

        // // Validar el formato del timestamp
        // if (!activityData.timestamp || isNaN(Date.parse(activityData.timestamp))) {
        //     throw new Error('Formato de timestamp incorrecto');
        // }

        // // Validar otros campos según sea necesario
        // if (typeof activityData.presence_status !== 'string') {
        //     throw new Error('Formato de presence_status incorrecto');
        // }

        // Crear un nuevo registro en Odoo
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

// Exportar la función principal para que pueda ser importada y utilizada en otros archivos
module.exports = {
    sendDataToOdoo
};
