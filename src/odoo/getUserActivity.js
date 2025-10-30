const xmlrpc = require('xmlrpc');
const { getCredentials } = require('../utils/crendentialManager');

async function getUserActivity() {
    try {
        const { username, password, uid, url, db } = await getCredentials(['username', 'password', 'uid', 'url', 'db']);

        if (!username || !password || !uid || !url) {
            throw new Error('Credenciales no encontradas. Por favor, autentique nuevamente.');
        }

        let models
        if (url.includes('https://')) {
            models = xmlrpc.createSecureClient({ url: `${url}/xmlrpc/2/object` });
        } else {
            models = xmlrpc.createClient({ url: `${url}/xmlrpc/2/object` });
        }

        const today = new Date().toLocaleDateString('en-US', {
            year: 'numeric', month: '2-digit', day: '2-digit'
        });



        const start_date = new Date(`${today} 00:00:00`).toISOString();
        const end_date = new Date(`${today} 23:59:59`).toISOString();

        const domain = [
            ['timestamp', '>=', start_date],
            ['timestamp', '<=', end_date],
            ['user_id', '=', parseInt(uid)],
            ['presence_status', '=', 'active']
        ];

        const domainSummary = [
            ['start_time', '>=', start_date],
            ['end_time', '<=', end_date],
            ['user_id', '=', parseInt(uid)]
        ];

        // Obtener user.activity solo del día actual
        const activities = await new Promise((resolve, reject) => {
            models.methodCall(
                'execute_kw',
                [db, uid, password, 'user.activity', 'search_read', [domain, ['id', 'user_id', 'timestamp', 'partner_id', 'description','task_id','pause_id','brand_id']]],
                (err, result) => {
                    if (err) {
                        console.error('Error al obtener user.activity en Odoo:', err);
                        reject(err);
                        return;
                    }
                    // Ordenar los resultados por el campo 'timestamp' localmente
                    // result.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                    resolve(result);
                }
            );
        });


        // Obtener user.activity.summary solo del día actual
        const summaries = await new Promise((resolve, reject) => {
            models.methodCall(
                'execute_kw',
                [db, uid, password, 'user.activity.summary', 'search_read', [domainSummary, ['id', 'user_id', 'partner_id', 'start_time', 'end_time', 'total_hours']]],
                (err, result) => {
                    if (err) {
                        console.error('Error al obtener user.activity.summary en Odoo:', err);
                        reject(err);
                        return;
                    }
                    // result.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
                    resolve(result);
                }
            );
        });

        return { activities, summaries };

    } catch (error) {
        console.error('Error al consultar datos en Odoo:', error);
        return null;
    }
}

module.exports = {
    getUserActivity
};
