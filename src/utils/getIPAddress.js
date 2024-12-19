const https = require('https');
const http = require('http'); // Para pruebas locales
// const { checkDataAndSend } = require('./checkDataAndSend');

// Función para obtener la IP pública usando Promesas
function getPublicIPAddress() {
  return new Promise((resolve, reject) => {
    https.get('https://api.ipify.org?format=json', (resp) => {
      let data = '';

      // Recibe datos en trozos
      resp.on('data', (chunk) => {
        data += chunk;
      });

      // La respuesta completa se ha recibido
      resp.on('end', () => {
        try {
          const ip = JSON.parse(data).ip;
          resolve(ip);
        } catch (err) {
          reject('Error al parsear la respuesta de IP');
        }
      });

    }).on('error', (err) => {
      reject("Error al obtener la IP pública: " + err.message);
    });
  });
}

// Función para obtener la geolocalización a partir de la IP usando Promesas
function getGeolocation(ip) {
  return new Promise((resolve, reject) => {
    http.get(`http://ip-api.com/json/${ip}`, (resp) => {
      let data = '';

      // Recibe datos en trozos
      resp.on('data', (chunk) => {
        data += chunk;
      });

      // La respuesta completa se ha recibido
      resp.on('end', () => {
        try {
          const location = JSON.parse(data);
          resolve(location);
        } catch (err) {
          reject('Error al parsear la respuesta de geolocalización');
        }
      });

    }).on('error', (err) => {
      reject("Error al obtener la geolocalización: " + err.message);
    });
  });
}

// Exportar directamente la IP pública y la geolocalización
async function getIpAndLocation(activityData) {
  try {
    const ip = await getPublicIPAddress();
    const location = await getGeolocation(ip);
    activityData.ipAddress = ip;
    activityData.longitude = location.lon;
    activityData.latitude = location.lat;
    // setTimeout(() => checkDataAndSend(activityData), 1000);
  } catch (error) {
    console.error(error);
    return { ip: null, location: null };
  }
}

module.exports = { getIpAndLocation };
