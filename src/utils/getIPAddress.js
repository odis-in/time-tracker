const https = require('https');
const http = require('http'); // Para pruebas locales

function getPublicIPAddress(callback) {
  https.get('https://api.ipify.org?format=json', (resp) => {
    let data = '';

    // A chunk of data has been received.
    resp.on('data', (chunk) => {
      data += chunk;
    });

    // The whole response has been received. Print out the result.
    resp.on('end', () => {
      const ip = JSON.parse(data).ip;
      callback(ip);
    });

  }).on("error", (err) => {
    console.log("Error: " + err.message);
    callback(null);
  });
}

function getGeolocation(ip, callback) {
  http.get(`http://ip-api.com/json/${ip}`, (resp) => {
    let data = '';

    // A chunk of data has been received.
    resp.on('data', (chunk) => {
      data += chunk;
    });

    // The whole response has been received. Print out the result.
    resp.on('end', () => {
      const location = JSON.parse(data);
      callback(location);
    });

  }).on("error", (err) => {
    console.log("Error: " + err.message);
    callback(null);
  });
}

module.exports = { getPublicIPAddress, getGeolocation };
