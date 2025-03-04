const xmlrpc = require('xmlrpc');
const { getCredentials } = require('../utils/crendentialManager');

async function sendData(modelName, activityData) {
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

        activityData.user_id = uid;

        return new Promise((resolve, reject) => {
            models.methodCall('execute_kw', [db, uid, password, modelName, 'create', [activityData]], (err, result) => {
                if (err) {
                    console.error('Error al crear el registro en Odoo:', err);
                    reject({ status: 400, message: err.message, error: err.code });
                } else {
                    activityData.odoo_ids = result;
                    resolve({ status: 200, message: 'Activity data sent', odoo_ids: activityData.odoo_ids, data: result });
                }
            });
        });

    } catch (error) {
        console.error('Error al enviar datos a Odoo:', error);
        return { status: 500, message: 'Error al enviar datos', error: error.message };
    }
}


async function sendDataSummary(modelName, activityData) {
    
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

        const dataSummary = activityData.map((data) => {
            return {
                ...data,
                user_id: uid,
            };
        });

        const results = [];

        for (const data of dataSummary) {

            if (data.odoo_id !== ' ') {
                const dataToUpdate = {
                    start_time: data.start_time,
                    end_time: data.end_time,
                    total_hours: data.total_hours
                };
                await new Promise((resolve, reject) => {
                    models.methodCall('execute_kw', [db, uid, password, modelName, 'write', [[data.odoo_id], dataToUpdate]],
                        function (err, value) {
                            if (err) {
                                console.error("Error al actualizar el registro:", err);
                                reject(err);
                            } else {
                                resolve(value);
                            }
                        }
                    );
                });
            } else {


                const createData = {
                    partner_id: data.partner_id,
                    start_time: data.start_time,
                    end_time: data.end_time,
                    total_hours: data.total_hours,
                    user_id: data.user_id
                }
                
                const result = await new Promise((resolve, reject) => {
                    models.methodCall('execute_kw', [db, uid, password, modelName, 'create', [createData]],
                        (err, result) => {
                            if (err) {
                                reject(err);
                                return;
                            }
                            
                            resolve({ status: 200, message: 'Activity data sent', odoo_id: result });
                        }
                    );
                });
                results.push(result);
            }
        }

        return results;
    } catch (error) {
        console.error('Error al enviar datos a Odoo:', error);
        return { status: 500, message: 'Error al enviar datos', error: error.message };
    }
}

async function updateData(modelName, activityData) {
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

        const dataToUpdate = {
            start_time: activityData[0].start_time,
            end_time: activityData[0].end_time,
            total_hours: activityData[0].total_hours
        };

        // Llamada correcta a `execute_kw` con los parámetros apropiados
        models.methodCall('execute_kw', [db, uid, password, modelName, 'write', [[activityData[0].odoo_id], dataToUpdate]],
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
