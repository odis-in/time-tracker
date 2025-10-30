async function getConfig( session_id, url ) {
	
	try {

		const response = await fetch(`${url}/web/get_config`, {
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
    getConfig,
};