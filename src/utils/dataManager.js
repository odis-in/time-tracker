const { sendData, sendDataSummary, updateData } = require('../odoo/sendData');
const { toCorrectISO } = require('./calculateTimeDifference');
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
    console.time('funcion sendLocalData');
    const store = await getStore();
    const { uid } = await getCredentials(['uid'])
    const savedData = store.get(key);
    const sincroniceData = store.get(`work-day-${uid}`) || [];
    console.log('---------------------------SINCRO', sincroniceData)
    if (savedData && savedData.length > 0) {
        if(type === 'summary'){
            try {
                await sendDataSummary('user.activity.summary', savedData[0]);
                console.log('Datos locales del resumen enviados')
            } catch (err) {
                console.log('Error al enviar datos almacenados localmente:', err)
            }
        } else {
            for (const data of savedData) {
                try {
                    const activity = data.presence_status
                    const partner_id = data.partner_id;
                    const result = await sendData('user.activity', data);
                    console.log('Datos off line enviados  al servidor:', result.odoo_ids);
                   
                    
                    if (activity==='active') {
                        //filtrar por odoo_id = ' ' sincroniceData
                        //devolver solo el primero que encuntre
                        // sincroniceData.forEach(item => {
                        //     console.log('SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS');
                        //     console.log('---------------------------',item.client.id, partner_id)
                        // });
                        const resultSummaryData = await sendActivityUserSummary();
                        console.log('PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP2',partner_id);
                        const filteredData = sincroniceData.filter(item => (item.odoo_id === ' '  && item.client.id === partner_id));
                        console.log('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF2',filteredData);
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
    console.timeEnd('funcion sendLocalData');
}

async function handleData(activityData) {
    console.time('-----------------------GET STORE-----------------------');
    const store = await getStore();
    const conectado = store.get('connected');
    console.log(conectado)
    console.timeEnd('-----------------------GET STORE-----------------------');
    console.time('Coneccciont');
    // const isConnected = await checkServerConnection();
    // console.timeEnd('Coneccciont');
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
    // const store = await getStore();
    // const { uid } = await getCredentials(['uid']);
    console.time('sendActivityUserSummary3');


    console.time('------------------DATA INFO TIME -------------------------')
    const [store, uid ] = await Promise.all([
        getStore(),
        getCredentials(['uid'])
    ]);

    console.timeEnd('------------------DATA INFO TIME -------------------------')
    console.log(uid.uid);

    const work_day = store.get(`work-day-${uid.uid}`) || [];
    const today = new Date();
    const todayFormatted = today.toLocaleDateString('en-US');


    // console.time('------------------ACTIVITY DATA TIME -------------------------')
    // let activityData;

    // if (work_day.length >= 2) {
    //     const lastTwoWorkDays = work_day.slice(-2);
    //     activityData = lastTwoWorkDays.map(workDay => ({
    //         partner_id: workDay.client.id,
    //         start_time: toCorrectISO(`${workDay.date} ${workDay.startWork}`),
    //         end_time: toCorrectISO(`${workDay.date} ${workDay.endWork}`),
    //         total_hours: workDay.timeWorked,
    //         odoo_id: workDay.odoo_id ? workDay.odoo_id : ' '
    //     }));

    //     const workDataIndex = work_day.findIndex(data => data.odoo_id === todayFormatted);
    // } else if (work_day.length === 1) {
    //     const lastWorkDay = work_day[work_day.length - 1];
    //     activityData = [{
    //         partner_id: lastWorkDay.client.id,
    //         start_time: toCorrectISO(`${lastWorkDay.date} ${lastWorkDay.startWork}`),
    //         end_time: toCorrectISO(`${lastWorkDay.date} ${lastWorkDay.endWork}`),
    //         total_hours: lastWorkDay.timeWorked,
    //         odoo_id: lastWorkDay.odoo_id ? lastWorkDay.odoo_id : ' '
    //     }];
    // } else {
    //     console.log('No hay datos para enviar.');
    //     return { status: 400, message: 'No hay datos para enviar.' };
    // }

    // const isConnected = await checkServerConnection();
    const remainingData = work_day.filter(data => data.date >= todayFormatted);
    store.set(`work-day-${uid.uid}`, remainingData);
    let activityData = [];
    console.log('----------------------------------REMAMING DATA', remainingData)
    if (remainingData.length > 1 ){
        console.log('-----------------------------------ENTRO AQUI MAS DE 1')
        
        const index = remainingData.findIndex(data => data.odoo_id === ' ');
        console.log('-----------------------------------INDEX', index)
        console.log('-----------------------------------DATA', remainingData[index])
        if ( index !== -1) {
            const startIndex = (index > 0) ? index - 1 : index;  // Si es el primer elemento, no buscar previo
            
            const selectedData = remainingData.slice(startIndex, index + 1); //obtener previo y actual
            console.log('----------------------------------- ', selectedData);
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
             // Si no se encuentra ningún registro con odoo_id vacío
            console.log('-----------------------------------No hay registros con odoo_id vacío.');

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

    console.log('-----------------NEW FORMAT------------------')
    console.log(activityData);

    console.timeEnd('------------------ACTIVITY DATA TIME -------------------------')
    
    if (remainingData.length > 0) {
        try {
            console.time('-------------- SEND DATA SUMMARY TIME -------------------')
            const result = await sendDataSummary('user.activity.summary', activityData);
            console.timeEnd('-------------- SEND DATA SUMMARY TIME -------------------')

            console.log('Datos enviados al servidor:', activityData);
            // return { status: 200, message: 'Summary data sent', activityData };
            console.timeEnd('sendActivityUserSummary3');
            return (result[0]);
        } catch (error) {
            console.log('Error al enviar datos al servidor:', error);
            console.timeEnd('sendActivityUserSummary3');
            return { status: 400, message: error.message };
        }
    } else {
        console.log('No hay datos para enviar.');
        return { status: 400, message: 'No hay datos para enviar.' };
    }
    
}

module.exports = { handleData ,sendActivityUserSummary};