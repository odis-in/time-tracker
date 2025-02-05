const { sendData, sendDataSummary, updateData } = require('../odoo/sendData');
const { toCorrectISO } = require('./calculateTimeDifference');
const { checkServerConnection } = require('./checkConnection');

async function getStore() {
    const { default: Store } = await import('electron-store');
    return new Store(); 
}

async function saveDataLocally(activityData, key) {
	const store = await getStore();
    const savedData = store.get(key) || []; // Obtener datos almacenados o un array vacío
    savedData.push(activityData);
    store.set(key, savedData); // Guardar datos en almacenamiento local
    console.log('Datos guardados localmente debido a falta de conexión.', savedData);
}

async function sendLocalData(key, type) {
    const store = await getStore();
    const savedData = store.get(key);
    
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
                    await sendData('user.activity', data);
                    console.log('Datos enviados al servidor:', data);
                } catch (error) {
                    console.error('Error al enviar datos almacenados localmente:', error);
                    return; // Si falla el envío de un conjunto de datos, detener el proceso
                }
            }
        }
        
        store.delete(key); // Limpiar datos locales después de enviarlos
    }
}

async function handleData(activityData) {
    const isConnected = await checkServerConnection();
    if (isConnected) {
        try {
            await sendData('user.activity', activityData);
            console.log('Datos enviados al servidor.');
            await sendLocalData('offlineData','normal');
            await sendLocalData('offLineSummaryData', 'summary') 
        } catch (error) {
            console.error('Error al enviar datos al servidor, guardando en local:', error);
            saveDataLocally(activityData, 'offlineData');
        }
    } else {
        saveDataLocally(activityData, 'offlineData');
    }
}

async function getStoredData() {
    const store = await getStore();
    return store.get('offlineData') || []; // Obtener datos almacenados o un array vacío
}

async function sendActivityUserSummary() {
    const store = await getStore();
    const work_day = store.get('work-day') || [];
    const data_sent = store.get('data-sent') || []; 
    const today = new Date();
    const todayFormatted = today.toLocaleDateString('en-US');

    const lastWorkDay = work_day[work_day.length - 1];

    const activityData = [{
        partner_id: lastWorkDay.client.id,
        start_time: toCorrectISO(`${lastWorkDay.date} ${lastWorkDay.startWork}`),
        end_time: toCorrectISO(`${lastWorkDay.date} ${lastWorkDay.endWork}`),
        total_hours: lastWorkDay.timeWorked
    }];

    
    // const alreadySent = data_sent.some(sent =>
    //     sent.partner_id === activityData[0].partner_id &&
    //     sent.start_time === activityData[0].start_time
    // );
    // console.log(alreadySent)
    // if (alreadySent) {
    //     console.log('Los datos ya fueron enviados anteriormente:', activityData);
    //     updateData('user.activity.summary', activityData);
    //     return;
    // }

    const isConnected = await checkServerConnection();
    const remainingData = work_day.filter(data => data.date >= todayFormatted);
    store.set('work-day', remainingData);

    if (activityData.length > 0) {
        if (isConnected) {
            try {
                await sendDataSummary('user.activity.summary', activityData);
                console.log('Datos enviados al servidor:', activityData);
                // store.set('data-sent', [...data_sent, ...activityData]); // Agregar los datos enviados
            } catch (error) {
                console.log('Error al enviar datos al servidor:', error);
            }
        } else {
            saveDataLocally(activityData, 'offLineSummaryData');
        }
    } else {
        console.log('No hay datos para enviar.');
    }
}


module.exports = { handleData ,sendActivityUserSummary};