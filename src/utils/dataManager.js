const { sendData, sendDataSummary } = require('../odoo/sendData');
const { toCorrectISO } = require('./calculateTimeDifference');
const { checkServerConnection } = require('./checkConnection');

async function getStore() {
    const { default: Store } = await import('electron-store');
    return new Store(); 
}

async function saveDataLocally(activityData) {
	const store = await getStore();
    const savedData = store.get('offlineData') || []; // Obtener datos almacenados o un array vacío
    savedData.push(activityData);
    store.set('offlineData', savedData); // Guardar datos en almacenamiento local
    console.log('Datos guardados localmente debido a falta de conexión.', savedData);
}

async function sendLocalData() {
    const store = await getStore();
    const savedData = store.get('offlineData');
    if (savedData && savedData.length > 0) {
        for (const data of savedData) {
            try {
                await sendData('user.activity', data);
                console.log('Datos enviados al servidor:', data);
            } catch (error) {
                console.error('Error al enviar datos almacenados localmente:', error);
                return; // Si falla el envío de un conjunto de datos, detener el proceso
            }
        }
        store.delete('offlineData'); // Limpiar datos locales después de enviarlos
    }
}

async function handleData(activityData) {
    const isConnected = await checkServerConnection();
    if (isConnected) {
        try {
            await sendData('user.activity', activityData);
            console.log('Datos enviados al servidor.');

            await sendLocalData(); // Enviar datos almacenados localmente si hay conexión
            
        } catch (error) {
            console.error('Error al enviar datos al servidor, guardando en local:', error);
            saveDataLocally(activityData);
        }
    } else {
        saveDataLocally(activityData);
    }
}

async function getStoredData() {
    const store = await getStore();
    return store.get('offlineData') || []; // Obtener datos almacenados o un array vacío
}

async function sendActivityUserSummary() {

    const store = await getStore();
    const work_day = store.get('work-day') || [];
    const activityData = work_day.map((data) => {
        return{
            partner_id: data.client.id,
            start_time: toCorrectISO(`${data.date} ${data.startWork}`),
            end_time: toCorrectISO(`${data.date} ${data.endWork}`),
            total_hours: data.timeWorked
        }
    });
    try {
        await sendDataSummary('user.activity.summary', activityData);
        console.log('Datos enviados al servidor:', activityData);
    } catch (error) {
        console.log('Error al enviar datos al servidor:', error);
    }
    

}

module.exports = { handleData ,sendActivityUserSummary};