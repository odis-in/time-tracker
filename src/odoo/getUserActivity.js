const xmlrpc = require('xmlrpc');
const { getCredentials } = require('../utils/crendentialManager');

async function getUserActivity() {
    try {
        const { username, password, uid, url, db } = await getCredentials(['username', 'password', 'uid', 'url', 'db']);

        if (!username || !password || !uid || !url) {
            throw new Error('Credenciales no encontradas. Por favor, autentique nuevamente.');
        }

        const models = xmlrpc.createClient({ url: `${url}/xmlrpc/2/object` });

        // 🔹 Obtener la fecha de hoy en UTC (Formato: "YYYY-MM-DD")
        /// obtener formato de hora local 
        const today1test = new Date().toLocaleDateString('en-US', {
            year: 'numeric', month: '2-digit', day: '2-digit'
        });
        console.log(`Fecha de hoy si mi local xd, ${today1test}`);
        const today1 = new Date().toISOString().split('T')[0];
        console.log(`Fecha de hoy:, ${today1}`); 
        const start_date = new Date(`${today1test} 00:00:00`).toISOString();
        const end_date = new Date(`${today1test} 23:59:59`).toISOString();


        console.log(`Fecha de hoy nueva segura:, ${start_date}  ${end_date}`);
        const newDay = new Date();
        const domain = [
            ['timestamp', '>=', start_date],  
            ['timestamp', '<=', end_date],
            ['user_id', '=' , parseInt(uid)],
            ['presence_status', '=', 'active']
        ];
        
        const domainSummary = [
            ['start_time', '>=', start_date],
            ['end_time', '<=', end_date],
            ['user_id', '=' , parseInt(uid)]
        ];

        // Obtener user.activity solo del día actual
        const activities = await new Promise((resolve, reject) => {
            models.methodCall(
                'execute_kw',
                [db, uid, password, 'user.activity', 'search_read', [domain, ['id', 'user_id', 'timestamp', 'partner_id','description']]],
                (err, result) => {
                    if (err) {
                        console.error('Error al obtener user.activity en Odoo:', err);
                        reject(err);
                        return;
                    }
                    // Ordenar los resultados por el campo 'timestamp' localmente

                    // result.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                    console.log('Registros de user.activity (hoy) obtenidos:', result);
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
                    console.log('Registros de user.activity.summary (hoy) obtenidos:', result);
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
