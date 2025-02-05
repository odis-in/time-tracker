const xmlrpc = require('xmlrpc');
// const { db } = require('./config');
const { getCredentials } = require('../utils/crendentialManager');

async function sendData(modelName, activityData) {
    try {
        const { username, password, uid , url, db } = await getCredentials(['username', 'password', 'uid', 'url','db']);

        if (!username || !password || !uid || !url) {
            throw new Error('Credenciales no encontradas. Por favor, autentique nuevamente.');
        }

        const models = xmlrpc.createSecureClient({ url: `${url}/xmlrpc/2/object` });

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

        const models = xmlrpc.createSecureClient({ url: `${url}/xmlrpc/2/object` });

        const dataSummary = activityData.map((data) => { 
            return {
                ...data,
                user_id: uid,
            }
        });

        let domain;
        if (activityData[0].end_time.split(' ')[1] === '06:00') {
            domain = [['start_time', '>=', `${activityData[0].start_time}:00`], ['partner_id', '=', parseInt(activityData[0].partner_id)]];
        } else {
            domain = [['start_time', '>=', `${activityData[0].start_time}:00`], ['end_time', '<=', `${activityData[0].end_time}:59`], ['partner_id', '=', parseInt(activityData[0].partner_id)]];
        }

        const searchId = await new Promise((resolve, reject) => {
            models.methodCall(
                'execute_kw',
                [db, uid, password, modelName, 'search', [domain]],
                (err, result) => {
                    if (err) {
                        console.error('Error al buscar los registros en Odoooo:', err);
                        reject(err);
                        return;
                    }
                    resolve(result);
                }
            );
        });
        if (searchId.length > 0) {
            const dataToUpdate = {
                start_time: activityData[0].start_time,
                end_time: activityData[0].end_time,
                total_hours: activityData[0].total_hours
            };

            console.log('Actualizando registro existente:', searchId, dataToUpdate);

            models.methodCall('execute_kw', [db, uid, password, modelName, 'write', [[searchId[0]], dataToUpdate]], 
                function (err, value) {
                    if (err) {
                        console.error("Error al actualizar el registro:", err);
                    } else {
                        console.log("Registro actualizado con éxito:", value);
                    }
                }
            );
        } else {
            models.methodCall('execute_kw', [db, uid, password, modelName, 'create', [dataSummary]], (err, result) => {
                if (err) {
                    console.error('Error al crear el registro en Odoo:', err);
                    return;
                }
                console.log(`Registro creado con ID: ${result}`);
            });
        }
    } catch (error) {
        console.error('Error al enviar datos a Odoo:', error);
    }
}

async function updateData(modelName , activityData) {
    try {
        const { username, password, uid , url, db } = await getCredentials(['username', 'password', 'uid', 'url','db']);

        if (!username || !password || !uid || !url) {
            throw new Error('Credenciales no encontradas. Por favor, autentique nuevamente.');
        }

        const models = xmlrpc.createSecureClient({ url: `${url}/xmlrpc/2/object` });

        let domain;
        if (activityData[0].end_time.split(' ')[1] === '06:00') {
            domain = [['start_time', '>=', `${activityData[0].start_time}:00`], ['partner_id', '=', parseInt(activityData[0].partner_id)]];
        } else {
            domain = [['start_time', '>=', `${activityData[0].start_time}:00`], ['end_time', '<=', `${activityData[0].end_time}:59`], ['partner_id', '=', parseInt(activityData[0].partner_id)]];
        }

        const searchId = await new Promise((resolve, reject) => {
            models.methodCall(
                'execute_kw',
                [db, uid, password, 'user.activity.summary', 'search', [domain]],
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

        if (searchId.length === 0) {
            console.log('No se encontraron registros para eliminar.');
            return;
        }
        const dataToUpdate = {
            start_time: activityData[0].start_time,
            end_time: activityData[0].end_time,
            total_hours: activityData[0].total_hours
        };

        console.log('----------------->', searchId, dataToUpdate);
        
        // Llamada correcta a `execute_kw` con los parámetros apropiados
        models.methodCall('execute_kw', [db, uid, password, modelName, 'write', [[searchId[0]], dataToUpdate]], 
            function (err, value) {
                if (err) {
                    console.error("Error al actualizar el registro:", err);
                } else {
                    console.log("Registro actualizado con éxito:", value);
                }
            }
        );
    } catch (error) {
        console.error('Error al enviar datos a Odoo:', error);
    }
}

module.exports = {
    sendData, sendDataSummary, updateData
};
