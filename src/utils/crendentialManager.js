const keytar = require('keytar');

async function saveCredentials(username, password, url, timeNotification, uid, db) {
    await keytar.setPassword('my-app', 'username', username);
    await keytar.setPassword('my-app', 'password', password);
    await keytar.setPassword('my-app', 'url', url);
    await keytar.setPassword('my-app', 'timeNotification', timeNotification);
    await keytar.setPassword('my-app', 'uid', uid);
    await keytar.setPassword('my-app', 'db', db);
}

async function getCredentials(credentialsToFetch = ['username', 'password', 'url', 'timeNotification', 'uid']) {
    const credentials = {};

    for (const key of credentialsToFetch) {
        credentials[key] = await keytar.getPassword('my-app', key);
    }

    return credentials;
}

async function clearCredentials() {
    await keytar.deletePassword('my-app', 'username');
    await keytar.deletePassword('my-app', 'password');
    await keytar.deletePassword('my-app', 'url');
    await keytar.deletePassword('my-app', 'timeNotification');
    await keytar.deletePassword('my-app', 'uid');
    await keytar.deletePassword('my app', 'db'); 
}

module.exports = { saveCredentials, getCredentials, clearCredentials };