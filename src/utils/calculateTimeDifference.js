function calculateTimeDifference(time1, time2) {
    const [h1, m1] = time1.split(":").map(Number);
    const [h2, m2] = time2.split(":").map(Number);

    const time1InMinutes = h1 * 60 + m1;
    const time2InMinutes = h2 * 60 + m2;

    

    let differenceInMinutes = Math.abs(time2InMinutes - time1InMinutes);
    const hours = Math.floor(differenceInMinutes / 60);
    const minutes = differenceInMinutes % 60;

    return time2 === '00:00'
        ? '00:00'
        : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}


function convertDate(hour) {
    if (hour === '--:--:--') {
        return '00:00';
    } else {
        
        const hourISO = hour; 
        const now = new Date().toISOString().split("T")[0]; 
        const dateISO = `${now}T${hourISO}Z`; 
        const date = new Date(dateISO); 

        
        const hourLocal = date.toLocaleTimeString('es-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

        
        return hourLocal; 
    }
}

function toCorrectISO(dateInput) {

    const localDate = new Date(dateInput);

    if (isNaN(localDate)) {
        throw new Error("Fecha inválida");
    }

    const year = localDate.getUTCFullYear();
    const month = String(localDate.getUTCMonth() + 1).padStart(2, '0'); 
    const day = String(localDate.getUTCDate()).padStart(2, '0');
    const hours = String(localDate.getUTCHours()).padStart(2, '0');
    const minutes = String(localDate.getUTCMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

module.exports = {
	calculateTimeDifference, convertDate, toCorrectISO
};