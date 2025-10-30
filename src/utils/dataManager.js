const { getSendScreenshot } = require('../odoo/getSendScreenshot');
const { sendData, sendDataSummary, updateData } = require('../odoo/sendData');
const { toCorrectISO, convertDate, calculateTimeDifference } = require('./calculateTimeDifference');
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
    store.set(key, savedData);
}

async function sendLocalData(key, type) {
    
    const store = await getStore();
    const { uid } = await getCredentials(['uid'])
    const savedData = store.get(key);
    const sincroniceData = store.get(`data-user-${uid}`) || [];

    if (savedData && savedData.length > 0) {
        const send_screenshot = await getSendScreenshot()
        if (type === 'summary') {
            let dataInfo = [];
            let current = null;
            savedData.forEach((data, index, arr) => {

                const isLast = index === arr.length - 1; // Verificar si es el último elemento

                if (!current || current.partner_id !== data.partner_id) {
                    if (current) {
                        current.end_time = data.timestamp;
                        current.total_hours = calculateTimeDifference(
                            current.start_time.split(' ')[1],
                            current.end_time.split(' ')[1]);
                    }
                    // Crear un nuevo registro, cuando cambia el partner_id, si el partner_id no tiene un consecutivo, el end_time es null
                    current = {
                        odoo_id: ' ',
                        partner_id: data.partner_id,
                        start_time: data.timestamp,
                        end_time: isLast ? null : arr[index + 1].timestamp,
                        total_hours: calculateTimeDifference(
                            data.timestamp.split(' ')[1], 
                            isLast ? '00:00' : arr[index + 1].timestamp.split(' ')[1]
                        )
                    };
                    dataInfo.push(current);
                }
            });

            try {
                await sendDataSummary('user.activity.summary', dataInfo);
            } catch (err) {
                console.error('Error al enviar datos de reusmen almacenados localmente:', err);
            }
        } else {
            let result = 0;

            for (const data of savedData) {
                try {
                    data.screenshot = send_screenshot ? data.screenshot : null;

                    result = await sendData('user.activity', data);

                } catch (error) {
                    console.error('Error al enviar datos almacenados localmente:', error);
                    return; // Si falla el envío de un conjunto de datos, detener el proceso
                }
            }
            
            if (result.status === 200) {
                store.delete(key); // Limpiar datos almacenados
            }
        }

    }

}

async function handleData(activityData) {
    try {
        // // const [, , result] = await Promise.all([
        // //     sendLocalData('offlineData', 'normal'),
        // //     sendLocalData('offlineData', 'summary'),
        // //     sendData('user.activity', activityData),
        // // ]);
        const result = await sendData('user.activity', activityData);
        return result;
    } catch (error) {
        console.error('Error al enviar datos al servidor, guardando en local:', error);
        saveDataLocally(activityData, 'offlineData');
        return { status: error.status, message: error.message, error: error.error };
    }


}

async function getStoredData() {
    const store = await getStore();
    return store.get('offlineData') || []; // Obtener datos almacenados o un array vacío
}

async function sendActivityUserSummary() {


    const [store, uid] = await Promise.all([
        getStore(),
        getCredentials(['uid'])
    ]);

    const work_day = store.get(`work-day-${uid.uid}`) || [];

    const today = new Date();
    const todayFormatted = today.toLocaleDateString('en-US');

    const remainingData = work_day.filter(data => data.date >= todayFormatted);
    store.set(`work-day-${uid.uid}`, remainingData);
    let activityData = [];
    if (remainingData.length > 1) {
        const index = remainingData.findIndex(data => data.odoo_id === ' ');
        if (index !== -1) {
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

module.exports = { handleData, sendActivityUserSummary, sendLocalData , saveDataLocally};