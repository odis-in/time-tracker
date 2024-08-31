require('dotenv').config();
const xmlrpc = require('xmlrpc');
const {url, db} = require('./config');
const common = xmlrpc.createClient({ url: url + '/xmlrpc/2/common' });

function authenticateUser(username, password) {
    console.log('Autenticando con Odoo...');

    return new Promise((resolve, reject) => {
        common.methodCall('authenticate', [db, username, password, {}], (err, uid) => {
            if (err) {
                console.error('Error al autenticar:', err);
                return reject(err);
            }

            if (!uid) {
                console.error('Error: autenticación fallida');
                return reject(new Error('Autenticación fallida'));
            }

            console.log('Autenticación exitosa. UID:', uid);
            resolve(uid);
        });
    });
}

module.exports = {
    authenticateUser
};  