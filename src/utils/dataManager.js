const { sendData, sendDataSummary, updateData } = require('../odoo/sendData');
const { toCorrectISO, convertDate } = require('./calculateTimeDifference');
const { checkServerConnection } = require('./checkConnection');
const { getCredentials } = require('./crendentialManager');


async function getStore() {
    const { default: Store } = await import('electron-store');
    return new Store(); 
}

async function saveDataLocally(activityData, key) {
	const store = await getStore();
    const savedData = store.get(key) || []; 
    savedData.push(activityData);

    //ordenar por "timestamp": "2025-02-17 06:00 de menor a mayor" 
    const order_data = savedData.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    store.set(key, order_data); 
    
}

async function sendLocalData(key, type) {
    
    const store = await getStore();
    const { uid } = await getCredentials(['uid'])
    const savedData = store.get(key);
    const sincroniceData = store.get(`work-day-${uid}`) || [];
    
    if (savedData && savedData.length > 0) {
        if(type === 'summary'){
            try {
                await sendDataSummary('user.activity.summary', savedData[0]);
    
            } catch (err) {
    
            }
        } else {
            let index = 0;
            for (const data of savedData) {
                try {
                    const activity = data.presence_status
                    const partner_id = data.partner_id;
                    const time = convertDate(data.timestamp.split(' ')[1])
                    //ver si no se a borrado de work-day-uid
                    const dataInsincroniceData = sincroniceData.filter(element => 
                        element.client.id === partner_id && 
                        element.startWork <= time && 
                        element.endWork >= time
                      );
                    
                    if (dataInsincroniceData.length === 0) {
    
                        savedData.slice(index, 1); //borrar objeto actual
                        store.set(key, savedData);
                    } else  {
                    result = await sendData('user.activity', data);
    
                    }
                    
                    if (activity==='active') {
                        
                        const resultSummaryData = await sendActivityUserSummary();
                        
                        const filteredData = sincroniceData.filter(item => (item.odoo_id === ' '  && item.client.id === partner_id));
                        
                        filteredData.forEach( i => {
                            i.odoo_ids.push(result.odoo_ids);
                            i.odoo_id = resultSummaryData?.odoo_id ? resultSummaryData.odoo_id : i.odoo_id;
                        });
                        store.set(`work-day-${uid}`, sincroniceData);
                    }
                    


                } catch (error) {
                    console.error('Error al enviar datos almacenados localmente:', error);
                    return; // Si falla el envío de un conjunto de datos, detener el proceso
                }
            }
        }
        
        store.delete(key); 
    }
    
}

async function handleData(activityData) {
    try {
        const [_,resutl] = await Promise.all([
            sendLocalData('offlineData', 'normal'),
            sendData('user.activity', activityData),
            
        ]
        );
        return resutl;
    } catch (error) {
        console.error('Error al enviar datos al servidor, guardando en local:', error);
        saveDataLocally(activityData, 'offlineData');
        return { status: error.status , message: error.message , error: error.error };
    }

    
}

async function getStoredData() {
    const store = await getStore();
    return store.get('offlineData') || []; // Obtener datos almacenados o un array vacío
}

async function sendActivityUserSummary() {
    

    const [store, uid ] = await Promise.all([
        getStore(),
        getCredentials(['uid'])
    ]);

    const work_day = store.get(`work-day-${uid.uid}`) || [];
    
    const today = new Date();
    const todayFormatted = today.toLocaleDateString('en-US');

    const remainingData = work_day.filter(data => data.date >= todayFormatted);
    store.set(`work-day-${uid.uid}`, remainingData);
    let activityData = [];
    if (remainingData.length > 1 ){
        const index = remainingData.findIndex(data => data.odoo_id === ' ');
        if ( index !== -1) {
            const startIndex = (index > 0) ? index - 1 : index;  // Si es el primer elemento, no buscar previo
            
            const selectedData = remainingData.slice(startIndex, index + 1); //obtener previo y actual
            
            selectedData.forEach(data => {
                activityData.push({
                    partner_id: data.client.id,
                    start_time: toCorrectISO(`${data.date} ${data.startWork}`),
                    end_time: toCorrectISO(`${data.date} ${data.endWork}`),
                    total_hours: data.timeWorked,
                    odoo_id: data.odoo_id ? data.odoo_id : ' '
                });
            });

        } else {
            // Enviar solo el último registro
            const lastData = remainingData[remainingData.length - 1]; // Obtener el último registro
            activityData.push({
                partner_id: lastData.client.id,
                start_time: toCorrectISO(`${lastData.date} ${lastData.startWork}`),
                end_time: toCorrectISO(`${lastData.date} ${lastData.endWork}`),
                total_hours: lastData.timeWorked,
                odoo_id: lastData.odoo_id ? lastData.odoo_id : ' '
            });
        }


    } else {
        activityData.push({
            partner_id: remainingData[0].client.id,
            start_time: toCorrectISO(`${remainingData[0].date} ${remainingData[0].startWork}`),
            end_time: toCorrectISO(`${remainingData[0].date} ${remainingData[0].endWork}`),
            total_hours: remainingData[0].timeWorked,
            odoo_id: remainingData[0].odoo_id ? remainingData[0].odoo_id : ' '
        })
    } 
    
    if (remainingData.length > 0) {
        try {
            const result = await sendDataSummary('user.activity.summary', activityData);
            
            return (result[0]);
        } catch (error) {
            return { status: 400, message: error.message };
        }
    } else {
        
        return { status: 400, message: 'No hay datos para enviar.' };
    }
    
}

module.exports = { handleData ,sendActivityUserSummary};