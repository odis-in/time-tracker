async function getClients(session_id, url) {
	try {

		const response = await fetch(`${url}/web/get_partner`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'Cookie': session_id
			}
		});

		const responseText = await response.json();


		if (response.status !== 200) {
			console.log('Error al obtener los clientes de Odoo:', response.statusText);
			return;
		}

		try {
			const dataOrder = responseText.sort(function (a, b) {
				if (a.name.toLowerCase() < b.name.toLowerCase()) {
					return -1;
				}
				if (a.name.toLowerCase() > b.name.toLowerCase()) {
					return 1;   
				}
				return 0;     
			});

			return dataOrder;
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
