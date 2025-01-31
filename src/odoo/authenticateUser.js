// require('dotenv').config();
// const xmlrpc = require('xmlrpc');
// const { db } = require('./config');

// function authenticateUser(username, password, url, db) {

//     const common = xmlrpc.createClient({ url: url + '/xmlrpc/2/common' });
//     console.log('Autenticando con Odoo...');

//     return new Promise((resolve, reject) => {
//         common.methodCall('authenticate', [db, username, password, {}], (err, uid) => {
//             if (err) {
//                 console.error('Error al autenticar:', err);
//                 return reject(err);
//             }

//             if (!uid) {
//                 console.error('Error: autenticación fallida');
//                 return reject(new Error('Autenticación fallida'));
//             }

//             resolve(uid);
//         });
//     });
// }


async function authenticateUser(username, password, url, db) {
	const url_odoo = `${url}/web/session/authenticate`; 
	const data = {
	  jsonrpc: "2.0",
	  method: "call",
	  params: {
		db: db,
		login: username,
		password: password
	  }
	};
  
	try {
	  const response = await fetch(url_odoo, {
		method: 'POST',
		headers: {
		  'Content-Type': 'application/json',
		},
		body: JSON.stringify(data)
	  });
	  const result = await response.json();
	  if (response.ok) {
        const setCookieHeader = response.headers.getSetCookie()[0];
		const uid = result.result.uid;
		if (setCookieHeader) {
		  console.log('Autenticación exitosa');
		  return {setCookieHeader, uid };  
		} else {
		  console.log('No se encontró la cabecera Set-Cookie');
		}
	  } else {
		console.log('Fallo al intentar iniciar sesión');
	  }

	} catch (err) {
	  console.error('Error al intentar autenticar:', err);
	}
}

  

module.exports = {
    authenticateUser
};  