const { getCredentials } = require("./crendentialManager");

const checkServerConnection = async () => {
    try {
        const { url } = await getCredentials(['url']);
        console.log('Conectando al servidor:');
        const response = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
        if (response.ok) {
            console.log('Conexión exitosa al servidor:');
            return true; 
        } else {
            console.log('El servidor respondió pero no con un estado de éxito:', response.status);
            
            return false; 
        }
    } catch (error) {
        console.error('Error al conectar con el servidor:', error.message);
        
        return false; 
    }
};

module.exports = { checkServerConnection }