const { ipcRenderer } = require('electron');
const { calculateTimeDifference, toCorrectISO } = require('../utils/calculateTimeDifference');
const { getClients } = require("../odoo/getClients");
const { sendData } = require('../odoo/sendData');
const { capture } = require('../utils/captureScreen');
const { getIpAndLocation } = require('../utils/getIPAddress');
const { checkDataAndSend } = require('../utils/checkDataAndSend');
const activityData = {
	odoo_id: null,
	presence: null,
	screenshot: null,
	latitude: null,
	longitude: null,
	ipAddress: null,
	partner_id: null,
	description: null
  };
     
function applyHourValidation(input) {
	input.addEventListener('input', (event) => {
		let value = event.target.value;
		
		
		value = value.replace(/[^0-9:]/g, '');

	
		if (value.length > 2 && value.indexOf(':') === -1) {
			value = value.slice(0, 2) + ':' + value.slice(2);
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


const editIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" width="20" height="20" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
<path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
</svg>`

const deleteIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" width="20" height="20" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
</svg>
`

const cancelIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" width="20" height="20" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
</svg>`

const saveIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" width="20" height="20" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
<path stroke-linecap="round" stroke-linejoin="round" d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 0 1 9 9v.375M10.125 2.25A3.375 3.375 0 0 1 13.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 0 1 3.375 3.375M9 15l2.25 2.25L15 12" />
</svg>`

function toggleAmPm(button) {
    if (button.textContent === 'AM') {
      button.textContent = 'PM';
    } else {
      button.textContent = 'AM';
    }
  }

async function showClients() {
	try {
		const clients = await getClients();
		console.log(clients);


		const clientSelect = document.getElementById('client');

		if (!clients || clients.length === 0) {
			console.warn('No hay clientes disponibles.');
			clientSelect.innerHTML = '<option value="">No hay clientes disponibles</option>';
			return;
		}
		
		clients.forEach(client => {

			if (client.name === '.') {
                return;
            }
			
			const option = document.createElement('option');
			option.value = client.id;
			option.textContent = client.name;
			clientSelect.appendChild(option);
		});
	} catch (error) {
		console.error('Error al obtener los clientes:', error);


		const clientSelect = document.getElementById('client');
		clientSelect.innerHTML = '<option value="">Error al cargar los clientes</option>';
	}
}

function editRow(button) {
	const row = button.closest('tr');

	// Aplicamos la validación a todos los inputs existentes al cargar la página
	

	const startTimeCell = row.querySelector('.start-time');
	const endTimeCell = row.querySelector('.end-time');

	const originalStartTime = startTimeCell.textContent;
	const originalEndTime = endTimeCell.textContent;

	startTimeCell.innerHTML = `<div class="time-container"  id="start-container" style="display: flex;">
								<input type="text" class="edit-input"  value="${originalStartTime.split(' ')[0]}" />
								<button class="time-mode" onclick="toggleAmPm(this)">${originalStartTime.split(' ')[1]}</button>
							</div>`;
	endTimeCell.innerHTML = `<div class="time-container"  id="end-container" style="display: flex;">
								<input type="text" class="edit-input"  value="${originalEndTime.split(' ')[0]}" />
								<button class="time-mode" onclick="toggleAmPm(this)">${originalEndTime.split(' ')[1] ? originalEndTime.split(' ')[1] : 'AM'}
</button>
							</div>`;

	const actionCell = row.querySelector('td:last-child');
	actionCell.innerHTML = `
	  <td><button class="save-btn" onclick="saveRow(this, '${originalStartTime}', '${originalEndTime}')">${saveIcon}</button><button class="cancel-btn" onclick="cancelEdit(this,'${originalStartTime}', '${originalEndTime}')">${cancelIcon}</button></td>
	  
	`;
	const start_container = document.getElementById('start-container');
	const end_container = document.getElementById('end-container');
	
	const existingInputsStart = start_container.querySelectorAll('input');
	existingInputsStart.forEach(input => {
	applyHourValidation(input);
	});

	const existingInputsEnd = end_container.querySelectorAll('input');
	existingInputsEnd.forEach(input => {
	applyHourValidation(input);
	});
	
}

async function saveRow(button, originalStartTime, originalEndTime) {
	const btnSave = document.querySelector('.btn-add');
	// const btnSend = document.getElementById('btn-send');
	const now = new Date().toLocaleTimeString('es-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
	if (btnSave.value != 'no_create') {
		const row = button.closest('tr');
		
		const startInput = convertTo24HourFormat(`${document.querySelector('.start-time input').value.trim()} ${document.querySelector('.start-time .time-mode').textContent.trim()}`);
		const endInput = convertTo24HourFormat(`${document.querySelector('.end-time input').value.trim()} ${document.querySelector('.end-time .time-mode').textContent.trim()}`);

		console.log(startInput, endInput);
		const index = row.rowIndex - 1;
		if ( startInput > now || endInput > now) {
			document.getElementById('message-error').textContent = 'NO SE PUEDE INGRESAR UNA HORA MAYOR A LA ACTUAL';
			return;
		}
		if (startInput >= endInput) {
			document.getElementById('message-error').textContent = 'LA HORA DE INCIO NO PUEDE SER MAYOR O IGUAL A LA HORA DE FIN';
		} else {

			document.getElementById('message-error').textContent = '';

			const workDayData = JSON.parse(localStorage.getItem('workDayData'));
			// console.log(workDayData[index - 1].endWork);
			// console.log('startInput', startInput)
			// console.log('ennd work', workDayData[index - 1].endWork)
			// console.log(startInput ,'<', workDayData[index - 1].endWork);
			// console.log(startInput  < workDayData[index - 1].endWork);
			if (index > 0) {
				if (startInput < workDayData[index - 1].endWork || endInput > workDayData[index + 1]?.endWork) {
					document.getElementById('message-error').textContent = 'TRASLAPE DE HORAS';
					return;
				}
			}

			const updatedData = workDayData.map(item => {
				if (index === workDayData.indexOf(item)) {
					return {
						...item,
						startWork: startInput,
						endWork: endInput,
						timeWorked: calculateTimeDifference(startInput, endInput)
					};
				}
			
				
				row.querySelector('.time-work').textContent = calculateTimeDifference(startInput, endInput);
				return item;
			});
			localStorage.setItem('workDayData', JSON.stringify(updatedData));
			row.querySelector('.start-time').textContent = startInput.value;
			row.querySelector('.end-time').textContent = endInput.value;
			ipcRenderer.send('update-work-day', updatedData);

			row.querySelector('td:last-child').innerHTML = `<button class="edit-btn" onclick="editRow(this)">${editIcon}</button>`;
		}
	} else {
		btnSave.disabled = false;
		btnSave.style.cursor = 'pointer';
		// btnSend.disabled = false;
		// btnSend.style.cursor = 'pointer';
		const selectClient = document.querySelector('.client');
		const selectClientIndex = selectClient.selectedIndex;
		const selectClientText = selectClient.options[selectClientIndex].text;
		
		
		
		const startInput = convertTo24HourFormat(document.querySelector('.start-time input').value + ' ' + document.querySelector('.start-time .time-mode').textContent);
		const endInput = convertTo24HourFormat(document.querySelector('.end-time input').value + ' ' + document.querySelector('.end-time .time-mode').textContent);

		console.log(startInput, endInput);
		
		const workDayData = JSON.parse(localStorage.getItem('workDayData'));
		if (startInput >= endInput) {
			document.getElementById('message-error').textContent = 'LA HORA DE INCIO NO PUEDE SER MAYOR O IGUAL A LA HORA DE FIN';
			return;
		} else if (workDayData.some (item => startInput < item.endWork && endInput > item.startWork)) {
			document.getElementById('message-error').textContent = 'TRASLAPE DE HORAS';
			return;
		} else if (startInput > now || endInput	> now) {
			document.getElementById('message-error').textContent = 'NO SE PUEDE INGRESAR UNA HORA MAYOR A LA ACTUAL';
			return;
		}else if (selectClientText === '') {
			document.getElementById('message-error').textContent = 'DEBE SELECCIONAR UN CLIENTE';
			return;
		}else if (startInput.value == '00:00' || endInput.value == '00:00'){
			document.getElementById('message-error').textContent = 'DEBE INGRESAR UNA HORA VALIDA';
			return;
		} else {
			document.getElementById('message-error').textContent = '';
		}
		const newRecord = {
			client: {id: selectClient.value , name: selectClientText},
			date: new Date().toLocaleDateString('en-US'),
			startWork: startInput,
			endWork: endInput,
			timeWorked: calculateTimeDifference(startInput, endInput)
		}
	//		'2025-01-14 16:52:03',
		// console.log(toCorrectISO(`${newRecord.date} ${newRecord.startWork}`))
	    
		
		
		getIpAndLocation(activityData);
		activityData.partner_id = newRecord.client.id;
		activityData.presence = { timestamp: toCorrectISO(`${newRecord.date} ${newRecord.startWork}`), status: 'active'};

		console.log(activityData);

		
		  
		  
		  
		//   dataToSend.screenshot = activityData.screenshot.path;

		  

		// enviar info a odoo
		

		
		

		// if (workDayData.length > 0 && workDayData[workDayData.length - 1].endWork === '00:00') { 
		// 	const lastItem = workDayData[workDayData.length - 1];
		// 	lastItem.endWork = newRecord.startWork;
		// 	lastItem.timeWorked = calculateTimeDifference(lastItem.startWork, lastItem.endWork);
		// 	const updatedData = [...workDayData.slice(0, -1), lastItem, newRecord];
		// 	localStorage.setItem('workDayData', JSON.stringify(updatedData));
		// 	ipcRenderer.send('update-work-day', updatedData);
		// } else {
		// Aplicar la animación fade-in a la tabla o a las filas de la tabla
		const tbody = document.getElementById('work-day-tbody');
		tbody.classList.add('fade-in'); 
  
		setTimeout(() => {
		  tbody.classList.remove('fade-in'); 
		  
		}, 100); 
		btnSave.value = 'create';
		ipcRenderer.send('add-row', false);
		const updatedData = [...workDayData, newRecord];
		const order_data = updatedData.sort((a, b) => a.startWork.localeCompare(b.startWork));
		localStorage.setItem('workDayData', JSON.stringify(order_data));
		ipcRenderer.send('update-work-day', order_data)
	}
}

function cancelEdit(button, originalStartTime, originalEndTime) {
	const btnSave = document.querySelector('.btn-add');
	// const btnSend = document.getElementById('btn-send');
	btnSave.disabled = false;
	btnSave.style.cursor = 'pointer';
	btnSave.style.backgroundColor = '#0056b3';
	// btnSend.disabled = false;
	// btnSend.style.backgroundColor = '#0056b3';
	// btnSend.style.cursor = 'pointer';
	if(btnSave.value != 'no_create'){
	const row = button.closest('tr');
	document.getElementById('message-error').textContent = '';
	row.querySelector('.start-time').textContent = originalStartTime;
	row.querySelector('.end-time').textContent = originalEndTime;

	row.querySelector('td:last-child').innerHTML = `<td><button class="edit-btn" onclick="editRow(this)">${editIcon}</button><button class="cancel-btn" onclick="deleteRow(this)">${deleteIcon}</button></td>`; }
	else {
		const row = button.closest('tr');
		row.remove();
		btnSave.value = 'create';
		ipcRenderer.send('add-row', false);
		document.getElementById('message-error').textContent = '';
	}
}

function deleteRow(button) {
	const row = button.closest('tr');
	const index = row.rowIndex - 1;

	const modal = document.getElementById('confirmModal');
	modal.style.display = 'block';

	const confirmButton = document.getElementById('confirmDelete');
	const cancelButton = document.getElementById('cancelDelete');

	confirmButton.onclick = function () {
		const workDayData = JSON.parse(localStorage.getItem('workDayData'));
		const updatedData = workDayData.filter((item, i) => i !== index);
		localStorage.setItem('workDayData', JSON.stringify(updatedData));
		ipcRenderer.send('update-work-day', updatedData);
		renderWorkDayData();

		modal.style.display = 'none';
	};

	cancelButton.onclick = function () {
		modal.style.display = 'none';
	};
}

function addRow(button) {
	const btnSave = document.querySelector('.btn-add');
	// const btnSend = document.getElementById('btn-send');
	btnSave.disabled = true;
	btnSave.style.cursor = 'not-allowed';
	// // btnSend.disabled = true;
	// // btnSend.style.cursor = 'not-allowed';
	
	
	console.log(btnSave.value);
	if (btnSave.value === 'create') {
		console.log('Agregar');
		tbody = document.getElementById('work-day-tbody');
		rowsData = tbody.getElementsByTagName('tr');;
		const row = document.createElement('tr');
		row.classList.add('fade-in');
		showClients();
		row.innerHTML = `
		<td><select name="client" id="client" class="client"></td>
		<td class="start-time">
			<div class="time-container"  id="start-container" style="display: flex;">
				<input type="text" placeholder="00:00" class="edit-input">
				<button class="time-mode" onclick="toggleAmPm(this)">AM</button>
			</div>
		</td>
		<td class="end-time">
			<div class="time-container"  id="end-container" style="display: flex;">
				<input type="text" placeholder="00:00" class="edit-input">
				<button class="time-mode" onclick="toggleAmPm(this)">AM</button>
			</div>
		</td>
		<td>00:00:00</td>
		<td>
			<button class="save-btn" onclick="saveRow(this)">${saveIcon}</button>
			<button class="cancel-btn" onclick="cancelEdit(this)">${cancelIcon}</button>
		</td>`;
		// data.length === 2 ? tbody.removeChild(rowsData[0]) : ''
		// tbody.appendChild(row);
		tbody.insertBefore(row, tbody.firstChild);
		btnSave.value = 'no_create';
		ipcRenderer.send('add-row', true);

	}

	const start_container = document.getElementById('start-container');
	const end_container = document.getElementById('end-container');
	
	const existingInputsStart = start_container.querySelectorAll('input');
	existingInputsStart.forEach(input => {
	applyHourValidation(input);
	});

	const existingInputsEnd = end_container.querySelectorAll('input');
	existingInputsEnd.forEach(input => {
	applyHourValidation(input);
	});

}

function convertTo24HourFormat(time) {
    if (!time) return time; 
    
    const [hourMinute, period] = time.split(' '); 
    const [hour, minute] = hourMinute.split(':').map(Number); 
    
    let hour24;
    if (period === 'PM') {
        hour24 = hour === 12 ? 12 : hour + 12; 
    } else {
        hour24 = hour === 12 ? 0 : hour; 
    }
    
    
    return `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

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




async function renderWorkDayData() {
	const workDayData = await ipcRenderer.invoke('get-work-day')
	console.log(workDayData);
	const today = new Date();
	const todayFormatted = today.toLocaleDateString('en-US');
	console.log(todayFormatted)

	const filteredData = workDayData.filter(item => {
    const itemDate = item.date;
    return itemDate == todayFormatted;
	});

	localStorage.setItem('workDayData', JSON.stringify(filteredData));

	const tbody = document.getElementById('work-day-tbody');
	tbody.innerHTML = '';
	if (filteredData.length === 0) {
		const emptyRow = document.createElement('tr');
		emptyRow.innerHTML = `<td colspan="5">No hay datos disponibles</td>`;
		tbody.appendChild(emptyRow);
	}
	filteredData.forEach(item => {
		const row = document.createElement('tr');

		row.innerHTML = `
		<td>${item.client.name}</td>
		<td class="start-time">${convertTo12HourFormat(item.startWork)}</td>
		<td class="end-time">${convertTo12HourFormat(item.endWork)}</td>
		<td class="time-work">${item.timeWorked}</td>
		<td>
		  <button class="edit-btn" onclick="editRow(this)">${editIcon}</button>
		  <button class="cancel-btn" onclick="deleteRow(this)">${deleteIcon}</button>
		</td>
	  `;
		tbody.appendChild(row);
	});
}

document.addEventListener('DOMContentLoaded', () => {
	const closeButton = document.getElementById('close');
	closeButton.addEventListener('click', () => {
		ipcRenderer.send('close-main-window');
	});

	const usernameDiv = document.getElementById('username');

	if (usernameDiv) {
		usernameDiv.textContent = localStorage.getItem('username')
	}

	renderWorkDayData();

	ipcRenderer.on('work-day-updated', () => {
		renderWorkDayData();
		const btnSave = document.querySelector('.btn-add');
		btnSave.disabled = false;
		btnSave.style.cursor = 'pointer';
		btnSave.value = 'create';
	});

	
	document.getElementById('btn-send').addEventListener('click', () => {
		ipcRenderer.send('sendSummary');
	});

});

document.getElementById('logout').addEventListener('click', () => {
	ipcRenderer.send('logout');
});

document.getElementById('delete_data').addEventListener('click', () => {
	ipcRenderer.send('delete_data');
	localStorage.removeItem('workDayData');
});
