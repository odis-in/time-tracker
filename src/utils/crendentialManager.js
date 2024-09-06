const keytar = require('keytar');

async function saveCredentials(username, password, url, timeNotification, uid, db) {
    await keytar.setPassword('my-app', 'username', username);
    await keytar.setPassword('my-app', 'password', password);
    await keytar.setPassword('my-app', 'url', url);
    await keytar.setPassword('my-app', 'timeNotification', timeNotification);
    await keytar.setPassword('my-app', 'uid', uid);
    await keytar.setPassword('my-app', 'db', db);
}

async function getCredentials(credentialsToFetch = ['username', 'password', 'url', 'timeNotification', 'uid','db']) {
    const credentials = {};

    for (const key of credentialsToFetch) {
        credentials[key] = await keytar.getPassword('my-app', key);
    }

    return credentials;
}

async function clearCredentials() {
    const serviceName = 'my-app'; 
    const keys = ['username', 'password', 'url', 'timeNotification', 'uid','db']; 

    for (const key of keys) {
        try {
            await keytar.deletePassword(serviceName, key);
            console.log(`Eliminado ${key} de ${serviceName}`);
        } catch (error) {
            console.error(`Error al eliminar ${key}: ${error}`);
        }
    }

    console.log('Todas las credenciales han sido eliminadas.');
}

module.exports = { saveCredentials, getCredentials, clearCredentials };