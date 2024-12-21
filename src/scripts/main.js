const { ipcRenderer } = require('electron');

// Función que se ejecuta cuando se hace clic en "Editar"
function editRow(button) {
	const row = button.closest('tr');
	const startTimeCell = row.querySelector('.start-time');
	const endTimeCell = row.querySelector('.end-time');
  
	const originalStartTime = startTimeCell.textContent;
	const originalEndTime = endTimeCell.textContent;
  
	// Reemplaza las celdas por inputs
	startTimeCell.innerHTML = `<input type="text" class="edit-input" value="${originalStartTime}" />`;
	endTimeCell.innerHTML = `<input type="text" class="edit-input" value="${originalEndTime}" />`;
  
	// Reemplaza el botón de editar por los botones de guardar y cancelar
	const actionCell = row.querySelector('td:last-child');
	actionCell.innerHTML = `
	  <button class="save-btn" onclick="saveRow(this, '${originalStartTime}', '${originalEndTime}')">Guardar</button>
	  <button class="cancel-btn" onclick="cancelEdit(this, '${originalStartTime}', '${originalEndTime}')">Cancelar</button>
	`;
  }
  
  function saveRow(button, originalStartTime, originalEndTime) {
	const row = button.closest('tr');
	const startInput = row.querySelector('.start-time input');
	const endInput = row.querySelector('.end-time input');
  
	// Actualiza las celdas con los nuevos valores
	row.querySelector('.start-time').textContent = startInput.value;
	row.querySelector('.end-time').textContent = endInput.value;
  
	// Actualiza los datos en localStorage
	const workDayData = JSON.parse(localStorage.getItem('workDayData'));
	const clientName = row.querySelector('td:first-child').textContent;
  
	const updatedData = workDayData.map(item => {
	  if (item.client === clientName) {
		return {
		  ...item,
		  startWork: startInput.value,
		  endWork: endInput.value,
		  timeWorked: calculateTimeDifference(startInput.value, endInput.value)
		};
	  }
	  return item;
	});
  
	// Guardar los datos actualizados en localStorage
	localStorage.setItem('workDayData', JSON.stringify(updatedData));
  
	// Vuelve a mostrar el botón de editar
	row.querySelector('td:last-child').innerHTML = `<button class="edit-btn" onclick="editRow(this)">Editar</button>`;
  }
  
  function cancelEdit(button, originalStartTime, originalEndTime) {
	const row = button.closest('tr');
  
	// Revertir los valores de las celdas
	row.querySelector('.start-time').textContent = originalStartTime;
	row.querySelector('.end-time').textContent = originalEndTime;
  
	// Vuelve a mostrar el botón de editar
	row.querySelector('td:last-child').innerHTML = `<button class="edit-btn" onclick="editRow(this)">Editar</button>`;
  }
  
  

function calculateTimeDifference(time1, time2) {

    const [h1, m1, s1] = time1.split(":").map(Number);
    const [h2, m2, s2] = time2.split(":").map(Number);
    
    const time1InSeconds = h1 * 3600 + m1 * 60 + s1;
    const time2InSeconds = h2 * 3600 + m2 * 60 + s2;

    let differenceInSeconds = Math.abs(time1InSeconds - time2InSeconds);
    const hours = Math.floor(differenceInSeconds / 3600);
    differenceInSeconds %= 3600;
    const minutes = Math.floor(differenceInSeconds / 60);
    const seconds = differenceInSeconds % 60;

    return time2 === '00:00:00' 
        ? '00:00:00' 
        : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}


async function loadWorkDayData() {
	try {
	  const workDayData = await ipcRenderer.invoke('get-work-day');
	  const tbody = document.getElementById('work-day-tbody');
	  tbody.innerHTML = '';
  
	  if (workDayData && workDayData.length > 0) {
		const reformattedData = []; // Array que guardará el nuevo objeto
  
		workDayData.forEach((item, index) => {
		  const row = document.createElement('tr');
		  let startTime = item.startWork.split(' ')[1]; // Solo la hora de inicio
		  let endTime;
  
		  // Determinamos la hora de fin
		  if (index < workDayData.length - 1) {
			endTime = workDayData[index + 1].startWork.split(' ')[1];
		  } else {
			endTime = '00:00:00'; // Última entrada, hora de fin por defecto
		  }
  
		  // Calculamos las horas trabajadas
		  let timeWorked = calculateTimeDifference(startTime, endTime);
  
		  // Crear un objeto con la nueva estructura
		  const workDataObject = {
			client: item.client,   // Cliente
			startWork: startTime,  // Hora de inicio
			endWork: endTime,      // Hora de fin
			timeWorked: timeWorked // Tiempo trabajado
		  };
  
		  // Añadir el objeto al array
		  reformattedData.push(workDataObject);
  
		  // Crear la fila para la tabla HTML
		  row.innerHTML = `
			<td>${item.client}</td>
			<td class="start-time">${startTime}</td>
			<td class="end-time">${endTime}</td>
			<td>${timeWorked}</td>
			<td>
			  <button class="edit-btn" onclick="editRow(this)">Editar</button>
			</td>
		  `;
  
		  tbody.appendChild(row);
		});
  
		// Guardar los datos procesados en localStorage
		localStorage.setItem('workDayData', JSON.stringify(reformattedData));
	  } else {
		const emptyRow = document.createElement('tr');
		emptyRow.innerHTML = `<td colspan="4">No hay datos disponibles</td>`;
		tbody.appendChild(emptyRow);
	  }
	} catch (error) {
	  console.error('Error al cargar los datos de trabajo del día:', error);
	}
  }
  
  function renderWorkDayData(workDayData) {
	const tbody = document.getElementById('work-day-tbody');
	tbody.innerHTML = '';
  
	workDayData.forEach(item => {
	  const row = document.createElement('tr');
	  row.innerHTML = `
		<td>${item.client}</td>
		<td class="start-time">${item.startWork}</td>
		<td class="end-time">${item.endWork}</td>
		<td>${item.timeWorked}</td>
		<td>
		  <button class="edit-btn" onclick="editRow(this)">Editar</button>
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

	// loadWorkDayData();

	// ipcRenderer.on('work-day-updated', () => {
	// 	loadWorkDayData();
	// });

	const storedData = localStorage.getItem('workDayData');

	if (storedData) {
	  // Si hay datos en localStorage, los usamos
	  const workDayData = JSON.parse(storedData);
	  renderWorkDayData(workDayData);
	} else {
	  // Si no hay datos en localStorage, los obtenemos del ipcRenderer
	  loadWorkDayData();
	}

});

document.getElementById('logout').addEventListener('click', () => {
	ipcRenderer.send('logout');
});


document.getElementById('delete_data').addEventListener('click', () => { 
	ipcRenderer.send('delete_data');
});