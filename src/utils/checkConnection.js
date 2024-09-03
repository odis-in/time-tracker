const { url } = require("../odoo/config");

const checkServerConnection = async () => {
    try {
        // Realizar una solicitud HEAD para minimizar la carga de datos
        const response = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
        if (response.ok) {
            console.log('Conexión exitosa al servidor:', url);
            // document.getElementById('status').innerHTML = 'Conectado';
            return true; // Conexión exitosa
        } else {
            console.log('El servidor respondió pero no con un estado de éxito:', response.status);
            // document.getElementById('status').innerHTML = 'Desconectado';
            return false; // Respuesta del servidor no es exitosa
        }
    } catch (error) {
        console.error('Error al conectar con el servidor:', error.message);
        // document.getElementById('status').innerHTML = 'Desconectado';
        return false; // Error de red o de conexión
    }
};

module.exports = { checkServerConnection }