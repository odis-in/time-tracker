const { getCredentials } = require("./crendentialManager");

const checkServerConnection = async () => {
    try {
        console.time('desde checkServerConnection');

        console.time('url al server');
        const { url } = await getCredentials(['url']);
        console.timeEnd('url al server');
        
        const response = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
        if (response.ok) {
            console.log('Conexión exitosa al servidor:', url);
            // document.getElementById('status').innerHTML = 'Conectado';
            
            return true; 
        } else {
            console.log('El servidor respondió pero no con un estado de éxito:', response.status);
            // document.getElementById('status').innerHTML = 'Desconectado';
            
            return false; 
        }
    } catch (error) {
        console.error('Error al conectar con el servidor:', error.message);
        // document.getElementById('status').innerHTML = 'Desconectado';
        console.timeEnd('desde checkServerConnection');
        return false; 
    }
};

module.exports = { checkServerConnection }