const { ipcRenderer } = require('electron');

function convertTo12HourFormat(time) {
    if (!time || time === '00:00') return time; 
    
    
    if (time.includes('AM') || time.includes('PM')) {
        return time;
    }
    
    
    const [hour, minute] = time.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    
    
    return `${hour12.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} ${period}`;
}

function validateTimeRange(startTime, endTime) {	
	if (startTime.length <= 2) {
		startTime = startTime.padStart(2, '0') + ':00';
	}
	if (endTime.length <= 2) {
		endTime = endTime.padStart(2, '0') + ':00';
	}
	
	if (startTime === '' || endTime === '') {
		ipcRenderer.send('error-modal', 'Por favor ingresa una hora correcta');
		onCurrentError('Por favor ingresa una hora correcta');
		return;
	}

	const workDayData = JSON.parse(localStorage.getItem('workDayData'));
	const dateLocal = new Date().toLocaleDateString('en-CA', {year: 'numeric',month: '2-digit',day: '2-digit'});
	const now = new Date()
	const dateInit = new Date(`${dateLocal} ${startTime} ${document.getElementById('btn-tm-start').textContent}`)
	const dateEnd = new Date(`${dateLocal} ${endTime} ${document.getElementById('btn-tm-end').textContent}`)
	
	if (dateEnd <= dateInit) {
		ipcRenderer.send('error-modal', 'La hora de fin debe ser mayor a la hora de inicio');
		onCurrentError('La hora de fin debe ser mayor a la hora de inicio');
		return;
	}
	console.log(`${dateInit} > ${now} || ${dateEnd} > ${now}`)
	if ( dateInit > now || dateEnd > now ) {
		onCurrentError('No se puede ingresar una hora mayor a la actual');
		return;
	}
	
	isTraslaping = workDayData.some(item => {
		if (item.endWork === '00:00') {
			if ( dateInit.toTimeString().split(' ')[0].substring(0,5) >= item.startWork) {
				onCurrentError(`Traslape de horas con ${convertTo12HourFormat(item.startWork)}-${convertTo12HourFormat(item.endWork)}`);
				return true
			}
		} else {
			if (
				dateInit.toTimeString().split(' ')[0].substring(0,5) < item.endWork && 
				dateEnd.toTimeString().split(' ')[0].substring(0,5) > item.startWork
			) {	
				onCurrentError(`Traslape de horas con ${convertTo12HourFormat(item.startWork)}-${convertTo12HourFormat(item.endWork)}`);
				return true;
			}
		}
	})
	

	if (isTraslaping) {
		return;
	} 

	return { dateInit , dateEnd }
}

function applyHourValidation(input) {
	input.addEventListener('input', (event) => {
		
		let value = event.target.value;
		value = value.replace(/[^0-9:]/g, '');
	
		if (value.length > 2 && value.indexOf(':') === -1) {
			value = value.slice(0, 2) + ':' + value.slice(2);
		}

		if (value.length > 5) {
			value = value.slice(0, 5);
		}

		
		const [hours, minutes] = value.split(':');
		
		if (hours && minutes) {
			if (parseInt(hours) < 1 || parseInt(hours) > 12 || parseInt(minutes) > 59) {
				value = value.slice(0, -1); 
			}
		}

		event.target.value = value;
	});
}


module.exports =  { validateTimeRange , applyHourValidation };