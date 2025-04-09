const { ipcRenderer } = require('electron');
const { calculateTimeDifference, toCorrectISO } = require('../utils/calculateTimeDifference');
const {captureScreen } = require('../utils/captureScreen');
const { getIpAndLocation } = require('../utils/getIPAddress');
const { deleteData } = require('../odoo/deleteData');
const { updateData } = require('../odoo/sendData');

ipcRenderer.on('error-occurred', (event, error) => {
	
	console.error('Error recibido desde el proceso principal:', error.message);
	console.error('Stack Trace:', error.stack);
  });

ipcRenderer.on('info-send', (event, message) => {
	console.info(message);
});


ipcRenderer.on('timer-event',  (event, data) => {
	const btnPause = document.getElementById('btn-pause');
	if (data === 'pause') {
		btnPause.textContent = 'Reanudar';
	} else {
		btnPause.textContent = 'Pausar';
	}
});

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
        const { clients } = await ipcRenderer.invoke('get-clients-and-pauses');
        const clientSelect = document.getElementById('client');
        const taskSelect = document.getElementById('task');

        if (!clients || clients.length === 0) {
            console.warn('No hay clientes disponibles.');
            clientSelect.innerHTML = '<option value="">No hay clientes disponibles</option>';
            taskSelect.innerHTML = '<option value="">No hay tareas disponibles</option>';
            return;
        }

        clientSelect.innerHTML = '';
        taskSelect.innerHTML = '<option value="">Selecciona un cliente primero</option>';

        let firstValidClient = null;

        // Obtener el último cliente de localStorage
        const data = JSON.parse(localStorage.getItem('workDayData')) || [];
        const lastClient = data.length > 0 ? data[data.length - 1].client : null;

        // Si hay un cliente guardado, agregarlo como opción seleccionada
        if (lastClient) {
            const lastClientOption = document.createElement('option');
            lastClientOption.value = String(lastClient.id); // Convertir a string para evitar errores
            lastClientOption.textContent = lastClient.name;
            lastClientOption.selected = true;
            clientSelect.appendChild(lastClientOption);
        }

        // Agregar clientes a la lista
        clients.forEach(client => {
            if (client.name === '.' || (lastClient && client.id === lastClient.id)) {
                return;
            }

            const option = document.createElement('option');
            option.value = String(client.id);
            option.textContent = client.name;
            clientSelect.appendChild(option);

            if (!firstValidClient) {
                firstValidClient = client;
            }
        });


        const updateTasks = (clientId) => {
            taskSelect.innerHTML = '';

            if (!clientId) {
                taskSelect.innerHTML = '<option value="">Selecciona un cliente primero</option>';
                return;
            }

            const selectedClient = clients.find(client => String(client.id) === String(clientId));
			selectedClient.tasks.sort((a, b) => {
                if (a.name.toLowerCase() < b.name.toLowerCase()) {
                    return -1;  // a va antes que b
                }
                if (a.name.toLowerCase() > b.name.toLowerCase()) {
                    return 1;   // b va antes que a
                }
                return 0;     // son iguales
            });
            if (selectedClient && selectedClient.tasks.length > 0) {
                selectedClient.tasks.forEach(task => {
                    const option = document.createElement('option');
                    option.value = String(task.id);
                    option.textContent = task.name;
                    taskSelect.appendChild(option);
                });
            } else {
                taskSelect.innerHTML = '<option value="">No hay tareas disponibles</option>';
            }
        };

        // Evento para cambiar las tareas cuando se seleccione otro cliente
        clientSelect.addEventListener('change', () => {
            updateTasks(clientSelect.value);
        });

        // Seleccionar correctamente el cliente si hay uno guardado
        if (lastClient) {
            clientSelect.value = String(lastClient.id);
            updateTasks(lastClient.id);
        } else if (firstValidClient) {
            clientSelect.value = String(firstValidClient.id);
            updateTasks(firstValidClient.id);
        }

    } catch (error) {
        console.error('Error al obtener los clientes:', error);
        document.getElementById('client').innerHTML = '<option value="">Error al cargar los clientes</option>';
    }
}

async function editRow(button) {
	const workDayData = await ipcRenderer.invoke('get-work-day');
	localStorage.setItem('workDayData', JSON.stringify(workDayData));	
	const row = button.closest('tr');

	// Aplicamos la validación a todos los inputs existentes al cargar la página
	

	const startTimeCell = row.querySelector('.start-time');
	const endTimeCell = row.querySelector('.end-time');

	const originalStartTime = startTimeCell.textContent;
	const originalEndTime = endTimeCell.textContent;

	startTimeCell.innerHTML = `<div class="time-container"  id="start-container" style="display: flex;">
								<input type="text" class="edit-input" placeholder="00:00" value="${originalStartTime.split(' ')[0]}" />
								<button class="time-mode" onclick="toggleAmPm(this)">${originalStartTime.split(' ')[1]}</button>
							</div>`;
	endTimeCell.innerHTML = `<div class="time-container"  id="end-container" style="display: flex;">
								<input type="text" class="edit-input" placeholder="00:00" value="${originalEndTime.split(' ')[0]}" />
								<button class="time-mode" onclick="toggleAmPm(this)">${originalEndTime.split(' ')[1] ? originalEndTime.split(' ')[1] : 'AM'}
</button>
							</div>`;

	const actionCell = row.querySelector('td:last-child');
	actionCell.innerHTML = `
	  <td style="display:flex; gap:5px;"><button class="save-btn" onclick="saveRow(this, '${originalStartTime}', '${originalEndTime}')">${saveIcon}</button><button class="cancel-btn" onclick="cancelEdit(this,'${originalStartTime}', '${originalEndTime}')">${cancelIcon}</button></td>
	  
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
	tbody = document.getElementById('work-day-tbody');
	
	const btnSave = document.querySelector('.btn-add');
	// const btnSend = document.getElementById('btn-send');
	const now = new Date().toLocaleTimeString('es-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
	if (btnSave.value != 'no_create') {
		//ACTULIZANDO REGISTRO
		const row = button.closest('tr');

		const startInputValidate = document.querySelector('.start-time input').value;
		const endInputValidate = document.querySelector('.end-time input').value;
		if (startInputValidate === '' || endInputValidate === '') {
			document.getElementById('message-error').textContent = 'DEBE INGRESAR UNA HORA VALIDA';
			return
		}
		
		const startInput = convertTo24HourFormat(`${document.querySelector('.start-time input').value.trim()} ${document.querySelector('.start-time .time-mode').textContent.trim()}`);
		const endInput = convertTo24HourFormat(`${document.querySelector('.end-time input').value.trim()} ${document.querySelector('.end-time .time-mode').textContent.trim()}`);

		
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

			const hasOverlap = workDayData.some((item, i) => {
				if (i === index) {
					return false; 
				}
			
				let overlap = false;
			
				if (item.endWork === '00:00') {
					overlap = startInput >= item.startWork;
				} else {
					overlap = startInput < item.endWork && endInput > item.startWork;
				}
			
				if (overlap) {
					document.getElementById('message-error').textContent = 
						`TRASLAPE DE HORAS CON ${convertTo12HourFormat(item.startWork)} - ${convertTo12HourFormat(item.endWork)}`;
				}
			
				return overlap;
			});
			
			if (hasOverlap) {
				return;
			}
		
			const updateActivityData = [{
				partner_id: null,
				start_time: null,
				end_time:null,
				total_hours: null,
				odoo_id: null
			}];
			const updatedData = workDayData.map(item => {
				if (index === workDayData.indexOf(item)) {	
					updateActivityData[0].partner_id = item.client.id;
					updateActivityData[0].start_time = toCorrectISO(`${item.date} ${startInput}`);
					updateActivityData[0].end_time = toCorrectISO(`${item.date} ${endInput}`);
					updateActivityData[0].total_hours = calculateTimeDifference(startInput, endInput);
					updateActivityData[0].odoo_id = item.odoo_id;
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
			//ordenar
			const order_data = updatedData.sort((a, b) => a.startWork.localeCompare(b.startWork));
			localStorage.setItem('workDayData', JSON.stringify(order_data));
			ipcRenderer.send('update-work-day', order_data)

			updateData('user.activity.summary', updateActivityData)
			
			
			
		}
	} else {
		//CREANDO NUEVO REGISTRO
		// // // btnSave.disabled = false;
		// // // btnSave.style.cursor = 'pointer';
		// btnSend.disabled = false;
		// btnSend.style.cursor = 'pointer';
		const selectClient = document.querySelector('.client');
		const selectTask = document.querySelector('.task');
		const selectClientIndex = selectClient.selectedIndex;
		const selectClientText = selectClient.options[selectClientIndex].text;
		const selectTaskText = selectTask.options[selectTask.selectedIndex].text;
		
		const startInputValidate = document.querySelector('.start-time input').value;
		const endInputValidate = document.querySelector('.end-time input').value;
		if (startInputValidate === '' || endInputValidate === '') {
			document.getElementById('message-error').textContent = 'DEBE INGRESAR UNA HORA VALIDA';
			return
		}
		const startInput = convertTo24HourFormat(document.querySelector('.start-time input').value + ' ' + document.querySelector('.start-time .time-mode').textContent);
		const endInput = convertTo24HourFormat(document.querySelector('.end-time input').value + ' ' + document.querySelector('.end-time .time-mode').textContent);
		const description = document.querySelector('.description input').value;
		
		
		const workDayData = JSON.parse(localStorage.getItem('workDayData'));
		if (startInput >= endInput) {
			document.getElementById('message-error').textContent = 'LA HORA DE INCIO NO PUEDE SER MAYOR O IGUAL A LA HORA DE FIN';
			return;
		} else if (startInput > now || endInput	> now) {
			document.getElementById('message-error').textContent = 'NO SE PUEDE INGRESAR UNA HORA MAYOR A LA ACTUAL';
			return;
		} else if (workDayData.some(item => {
			if (item.endWork === '00:00') {
			document.getElementById('message-error').textContent = `TRASLAPE DE HORAS CON ${convertTo12HourFormat(item.startWork)}-${convertTo12HourFormat(item.endWork)}`;
			return startInput >= item.startWork
			} else {
				document.getElementById('message-error').textContent = `TRASLAPE DE HORAS CON ${convertTo12HourFormat(item.startWork)}-${convertTo12HourFormat(item.endWork)}`;
				return startInput < item.endWork && endInput > item.startWork;
			}
		})) {
			
			return;
		} else if (selectClientText === '') {
			document.getElementById('message-error').textContent = 'DEBE SELECCIONAR UN CLIENTE';
			return;
		}else if (startInput.value == '00:00' || endInput.value == '00:00'){
			document.getElementById('message-error').textContent = 'DEBE INGRESAR UNA HORA VALIDA';
			return;
		} else {
			document.getElementById('message-error').textContent = '';
		}
		const uid = localStorage.getItem('uid');
		const newRecord = {
			client: {id: parseInt(selectClient.value) , name: selectClientText},
			date: new Date().toLocaleDateString('en-US'),
			startWork: startInput,
			endWork: endInput,
			task: selectTask.value > 0 ? selectTaskText : ' ',
			description: description,
			timeWorked: calculateTimeDifference(startInput, endInput),
			userId: uid,
			odoo_id: ' ',
			odoo_ids: []
		}
		
		const updatedData = [...workDayData, newRecord];
		const order_data = updatedData.sort((a, b) => a.startWork.localeCompare(b.startWork));


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
			 
		
		await getIpAndLocation(activityData);
		await captureScreen(activityData);
		activityData.partner_id = parseInt(newRecord.client.id);
		activityData.presence = { timestamp: toCorrectISO(`${newRecord.date} ${newRecord.startWork}`), status: 'active'};
		activityData.description = description;
		activityData.task_id = parseInt(document.querySelector('.task').value);
		
		ipcRenderer.send('send-manual-data', activityData);
		ipcRenderer.send('update-work-day-front', order_data)
		tbody.classList.add('fade-in');
		tbody.classList.add('opacity-50'); 
		const btnSend = document.querySelector('.save-btn');
		btnSend.style.cursor = 'not-allowed';
		btnSend.disabled = true;
		ipcRenderer.once('send-manual-data-response', () => {
			const tbody = document.getElementById('work-day-tbody');
			tbody.classList.remove('opacity-50'); 
			tbody.classList.remove('tbody-disabled');
			tbody.classList.remove('fade-in'); 
			localStorage.setItem('workDayData', JSON.stringify(order_data));
			
			//habilitar botones de nuevo
			btnSave.disabled = false;
			btnSave.style.cursor = 'pointer';
			btnSave.value = 'create';
		});
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

	row.querySelector('td:last-child').innerHTML = `<td style="display:flex; gap:5px;"><button class="edit-btn" onclick="editRow(this)">${editIcon}</button><button class="cancel-btn" onclick="deleteRow(this)">${deleteIcon}</button></td>`; }
	else {
		const row = button.closest('tr');
		row.remove();
		btnSave.value = 'create';
		ipcRenderer.send('add-row', false);
		document.getElementById('message-error').textContent = '';
	}
	tbody = document.getElementById('work-day-tbody');
	tbody.classList.remove('tbody-disabled');
}

async function deleteRow(button) {
	//sincronizar antes
	
	const workDayData = await ipcRenderer.invoke('get-work-day');
	localStorage.setItem('workDayData', JSON.stringify(workDayData));
	//sincronzado
	
	
	const row = button.closest('tr');
	const index = row.rowIndex - 1;
	const dataRow = JSON.parse(localStorage.getItem('workDayData'));
	const rowSelected = dataRow.filter((item, i) => i === index);
	const odoo_ids = rowSelected[0].odoo_ids;
	const odoo_id = rowSelected[0].odoo_id;
	
	
	const modal = document.getElementById('confirmModal');
	modal.style.display = 'block';

	const confirmButton = document.getElementById('confirmDelete');
	const cancelButton = document.getElementById('cancelDelete');

	confirmButton.onclick = function () {
		deleteData(odoo_ids, odoo_id);
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
	
	btnSave.disabled = true;
	btnSave.style.cursor = 'not-allowed';
	
	if (btnSave.value === 'create') {
		
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
		<td><select name="task" id="task" class="task"></td>
		<td class="description">
			<input type="text" placeholder="Descripción">
		</td>
		<td>00:00</td>
		<td style="display:flex; gap:5px;">
			<button class="save-btn" onclick="saveRow(this)">${saveIcon}</button>
			<button class="cancel-btn" onclick="cancelEdit(this)">${cancelIcon}</button>
		</td>`;
		// data.length === 2 ? tbody.removeChild(rowsData[0]) : ''
		// tbody.appendChild(row);
		tbody.insertBefore(row, tbody.firstChild);
		btnSave.value = 'no_create';
		tbody.classList.add('tbody-disabled');
		const startTimeInput = row.querySelector('.start-time input');
		if (startTimeInput) {
			startTimeInput.focus();
		}
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
    console.log('-------------->', time)
    if (!time) return time; 

    const [hourMinute, period] = time.split(' ');
    
    let [hour, minute] = hourMinute.split(':').map(Number); 
    
    minute = isNaN(minute) ? '00' : minute.toString().padStart(2, '0');

    let hour24;
    if (period === 'PM') {
        hour24 = hour === 12 ? 12 : hour + 12; 
    } else {
        hour24 = hour === 12 ? 0 : hour; 
    }

    return `${hour24.toString().padStart(2, '0')}:${minute}`;
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

function convertTimeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

function convertMinutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(remainingMinutes).padStart(2, '0')}`;
}

async function renderWorkDayData() {
    const workDayData = await ipcRenderer.invoke('get-work-day');
    const today = new Date();
    const todayFormatted = today.toLocaleDateString('en-US');
    

    const filteredData = workDayData.filter(item => {
        const itemDate = item.date;
        return itemDate == todayFormatted;
    });

    localStorage.setItem('workDayData', JSON.stringify(filteredData));

    const tbody = document.getElementById('work-day-tbody');
    const counter = document.getElementById('counter');
    tbody.innerHTML = '';
    if (filteredData.length === 0 ) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `<td colspan="5">No hay datos disponibles</td>`;
        tbody.appendChild(emptyRow);
    }

    let totalMinutes = 0;
	const userId = localStorage.getItem('uid');
	
	
    filteredData.forEach(item => {
        const row = document.createElement('tr');
			
			row.innerHTML = `
			<td>${item.client.name}</td>
			<td class="start-time">${convertTo12HourFormat(item.startWork)}</td>
			<td class="end-time">${convertTo12HourFormat(item.endWork)}</td>
			<td> ${item.task} </td>
			<td class="description">${item.description}</td>
			<td class="time-work">${item.timeWorked}</td>
			<td style="display:flex; gap:5px;">
				<button class="edit-btn" style='visibility: hidden'; onclick="editRow(this)">${editIcon}</button>
				<button class="cancel-btn" style='visibility: hidden'; onclick="deleteRow(this)">${deleteIcon}</button>
			</td>`;
			
			// <button class="edit-btn" onclick="editRow(this)">${editIcon}</button>
			// <button class="cancel-btn" onclick="deleteRow(this)">${deleteIcon}</button>
			tbody.appendChild(row);

			totalMinutes += convertTimeToMinutes(item.timeWorked);
			
    });

    counter.textContent = convertMinutesToTime(totalMinutes);
}

document.addEventListener('DOMContentLoaded', () => {
    const closeButton = document.getElementById('close');
    closeButton.addEventListener('click', () => {
        ipcRenderer.send('close-main-window');
    });

    const usernameDiv = document.getElementById('username');
    const profileImage = document.getElementById('profileImage');
    if (usernameDiv) {
        usernameDiv.textContent = localStorage.getItem('name');
        window.addEventListener('storage', (event) => {
            if (event.key === 'name') {
                const username = localStorage.getItem('name');
                usernameDiv.textContent = username;
            }
        });
    }

    if (profileImage) {
        profileImage.src = localStorage.getItem('imageBase64');
        window.addEventListener('storage', (event) => {
            if (event.key === 'imageBase64') {
                const imageBase64 = localStorage.getItem('imageBase64');
                profileImage.src = imageBase64;
            }
        });
    }

    renderWorkDayData();
    ipcRenderer.on('work-day-updated', () => {
        renderWorkDayData();
        const btnSave = document.querySelector('.btn-add');
        btnSave.disabled = false;
        btnSave.style.cursor = 'pointer';
        btnSave.value = 'create';
    });
});

document.getElementById('logout').addEventListener('click', () => {
    ipcRenderer.send('logout');
});

function sumOFHoursWorked(time1, time2) {
    time1 = "00:45".split(':');
    time2 = "01:20".split(':');
    
    let secondSum = Number(time1[1]) + Number(time2[1]);
    let minSum = Number(time1[0]) + Number(time2[0]);
    
    if(secondSum > 59){
      secondSum = Math.abs(60 - secondSum);
      minSum += 1;
    }
    
    if(secondSum < 10){
      secondSum = `0${secondSum}`;
    }
    
    if(minSum < 10){
      minSum = `0${minSum}`;
    }
    
    return `${minSum}:${secondSum}`;   
}

document.addEventListener('DOMContentLoaded', () => {
	const closeButton = document.getElementById('close');
	closeButton.addEventListener('click', () => {
		ipcRenderer.send('close-main-window');
	});

	const closeAllButton = document.getElementById('close-all');
	closeAllButton.addEventListener('click', () => {
		ipcRenderer.send('close-all-windows');
	});

	const usernameDiv = document.getElementById('username');
	const profileImage = document.getElementById('profileImage');
	if (usernameDiv) {
		usernameDiv.textContent = localStorage.getItem('name')
		window.addEventListener('storage', (event) => {
			if (event.key === 'name') {
				renderWorkDayData();
				const username = localStorage.getItem('name');
				usernameDiv.textContent = username;
			}
		});
	}

	if (profileImage) {
		profileImage.src = localStorage.getItem('imageBase64');
		window.addEventListener('storage', (event) => {
			if (event.key === 'imageBase64') {
				const imageBase64 = localStorage.getItem('imageBase64');
				profileImage.src = imageBase64;
			}
		});
	}

	renderWorkDayData();
	
	// renderODOO();
	ipcRenderer.on('work-day-updated', () => {
		renderWorkDayData();
		const btnSave = document.querySelector('.btn-add');
		btnSave.disabled = false;
		btnSave.style.cursor = 'pointer';
		btnSave.value = 'create';
	});


});

const btnPause = document.getElementById('btn-pause');
document.getElementById('logout').addEventListener('click', () => {
	btnPause.textContent = 'Pausar';
	ipcRenderer.send('logout');
});




btnPause.addEventListener('click', () => {
    if (btnPause.textContent === "Pausar") {
        ipcRenderer.send('pause-timer');
    } 
	if (btnPause.textContent === "Reanudar") {
        ipcRenderer.send('resume-timer');
    }
});

function updateTime() {
	const currentTime = new Date().toLocaleString('en-US', { 
		year: 'numeric', month: '2-digit', day: '2-digit',
		hour:'2-digit', minute:'2-digit'
	}); 
	document.getElementById('date').textContent = currentTime; 
  }
  
  setInterval(updateTime, 1000);
updateTime();


