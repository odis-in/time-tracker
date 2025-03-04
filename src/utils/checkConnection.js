const { getCredentials } = require("./crendentialManager");

const checkServerConnection = async () => {
    try {
        

        
        const { url } = await getCredentials(['url']);
        
        
        const response = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
        if (response.ok) {
            // document.getElementById('status').innerHTML = 'Conectado';
            
            return true; 
        } else {
            // document.getElementById('status').innerHTML = 'Desconectado';
            
            return false; 
        }
    } catch (error) {
        console.error('Error al conectar con el servidor:', error.message);
        // document.getElementById('status').innerHTML = 'Desconectado';
        
        return false; 
    }
};

module.exports = { checkServerConnection }