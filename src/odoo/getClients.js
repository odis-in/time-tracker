// const xmlrpc = require('xmlrpc');
const { getCredentials } = require('../utils/crendentialManager');

async function getClients() {
    // try {
    //     const { username, password, uid, url, db } = await getCredentials(['username', 'password', 'uid', 'url', 'db']);

    //     if (!username || !password || !uid || !url) {
    //         throw new Error('Credenciales no encontradas. Por favor, autentique nuevamente.');
    //     }

    //     const models = xmlrpc.createClient({ url: `${url}/xmlrpc/2/object` });

        
    //     return new Promise((resolve, reject) => {
    //         models.methodCall(
    //             'execute_kw',
    //             [db, uid, password, 'res.partner', 'search_read', [[['customer_rank', '>', 0]], ['name']]],
    //             (err, result) => {
    //                 if (err) {
    //                     console.error('Error al obtener los clientes de Odoo:', err);
    //                     reject(err); 
    //                     return;
    //                 }
    //                 resolve(result); 
    //             }
    //         );
    //     });
    // } catch (error) {
    //     console.error('Error al consultar datos a Odoo:', error);
    //     throw error; 
    // }

	try {
        const { url, session_id } = await getCredentials(['url', 'session_id']);
		
		const response = await fetch(`${url}/web/get_partner`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'Cookie': session_id
			}
		});

		const responseText = await response.text();  
		
		if (response.status !== 200) {
			console.log('Error al obtener los clientes de Odoo:', response.statusText);
			return;
		}
		
		try {
			return JSON.parse(responseText);
		} catch (jsonError) {
			console.error('Error al parsear la respuesta JSON:', jsonError);
			return;
		}
	} catch (err) {
		console.error('Error al obtener los clientes de Odoo:', err);
	}

}

module.exports = {
    getClients,
};
