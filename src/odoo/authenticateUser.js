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

        if (response.ok && result.result) {
            const setCookieHeader = response.headers.getSetCookie ? response.headers.getSetCookie()[0] : null;
            const uid = result.result.uid;
            const name = result.result.name;
            const partner_id = result.result.partner_id;
            console.log(setCookieHeader, uid, name, partner_id);
            // Construir la URL de la imagen
            // `/web/image/res.partner/${partner_id}/avatar_128`
            const image_url = `${url}/web/image/res.partner/${partner_id}/avatar_128`;

            // Descargar la imagen en Base64
            const imageResponse = await fetch(image_url, { 
                method: 'GET',
                headers: {
                    Cookie: setCookieHeader,
                }, 
                credentials: 'include'
            });
            
            if (!imageResponse.headers.get('Content-Type').includes('image/svg+xml')) {
                console.error("Error al obtener la imagen:", imageResponse.status , imageResponse.headers.get('Content-Type'));
                return { setCookieHeader, uid, name, imageBase64: null, image_url };
            }

            const svgContent = await imageResponse.text();
            const imageBase64 = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgContent);
            return { setCookieHeader, uid, name, imageBase64 };
        } else {
            console.log('Fallo al intentar iniciar sesión');
            return null;
        }
    } catch (err) {
        console.error('Error al intentar autenticar:', err);
        return null;
    }
}

module.exports = {
    authenticateUser
};
