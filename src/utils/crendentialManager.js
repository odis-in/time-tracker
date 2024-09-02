const keytar = require('keytar');

async function saveCredentials(username, password, uid) {
    await keytar.setPassword('my-app', 'username', username);
    await keytar.setPassword('my-app', 'password', password);
    await keytar.setPassword('my-app', 'uid', uid);
}

async function getCredentials() {
    const username = await keytar.getPassword('my-app', 'username');
    const password = await keytar.getPassword('my-app', 'password');
    const uid = await keytar.getPassword('my-app', 'uid');
    return { username, password, uid };
}

async function clearCredentials() {
    await keytar.deletePassword('my-app', 'username');
    await keytar.deletePassword('my-app', 'password');
    await keytar.deletePassword('my-app', 'uid');
}

module.exports = { saveCredentials, getCredentials, clearCredentials };