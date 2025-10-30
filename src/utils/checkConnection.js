const { getCredentials } = require("./crendentialManager");

const checkServerConnection = async () => {
    try {
        

        
        const { url } = await getCredentials(['url']);
        
        
        const response = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
        if (response.ok) {
            // document.getElementById('status').innerHTML = 'Conectado';
            
            return {status: true, message:'connection successful'}; 
        } else {
            // document.getElementById('status').innerHTML = 'Desconectado';
            
            return {status: false, message:`connection failed with status ${response.status}`} ; 
        }
    } catch (error) {
        // document.getElementById('status').innerHTML = 'Desconectado';
        
        return {status: false, message:`connection error: ${error.message}`}; 
    }
};

module.exports = { checkServerConnection }