const { ipcRenderer } = require('electron');

function editRow(button) {
	const row = button.closest('tr');
	
	const startTimeCell = row.querySelector('.start-time');
	const endTimeCell = row.querySelector('.end-time');
  
	const originalStartTime = startTimeCell.textContent;
	const originalEndTime = endTimeCell.textContent;

	startTimeCell.innerHTML = `<input type="text" class="edit-input" value="${originalStartTime}" />`;
	endTimeCell.innerHTML = `<input type="text" class="edit-input" value="${originalEndTime}" />`;

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
	const index = row.rowIndex-1; 
	
	row.querySelector('.start-time').textContent = startInput.value;
	row.querySelector('.end-time').textContent = endInput.value;
	
	const workDayData = JSON.parse(localStorage.getItem('workDayData'));
	
	const updatedData = workDayData.map(item => {
	  if (index === workDayData.indexOf(item)) {
		return {
		  ...item,
		  startWork: startInput.value,
		  endWork: endInput.value,
		  timeWorked: calculateTimeDifference(startInput.value, endInput.value)
		};
	  }

	row.querySelector('.time-work').textContent = calculateTimeDifference(startInput.value, endInput.value);
	  return item;
	});
  
	localStorage.setItem('workDayData', JSON.stringify(updatedData));
	const data = JSON.parse(localStorage.getItem('workDayData'));
	ipcRenderer.send('update-work-day', data);
	
	row.querySelector('td:last-child').innerHTML = `<button class="edit-btn" onclick="editRow(this)">Editar</button>`;
  }
  
  function cancelEdit(button, originalStartTime, originalEndTime) {
	const row = button.closest('tr');
  	
	row.querySelector('.start-time').textContent = originalStartTime;
	row.querySelector('.end-time').textContent = originalEndTime;
  
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

async function renderWorkDayData() {
	const workDayData = await ipcRenderer.invoke('get-work-day')
	localStorage.setItem('workDayData', JSON.stringify(workDayData));
	const tbody = document.getElementById('work-day-tbody');
	tbody.innerHTML = '';
	if (workDayData.length === 0) {
		const emptyRow = document.createElement('tr');
		emptyRow.innerHTML = `<td colspan="4">No hay datos disponibles</td>`;
		tbody.appendChild(emptyRow);
	}
	workDayData.forEach(item => {
	  const row = document.createElement('tr');
	  row.innerHTML = `
		<td>${item.client}</td>
		<td class="start-time">${item.startWork}</td>
		<td class="end-time">${item.endWork}</td>
		<td class="time-work">${item.timeWorked}</td>
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

	renderWorkDayData();

	ipcRenderer.on('work-day-updated', () => {
		renderWorkDayData();
	});

});

document.getElementById('logout').addEventListener('click', () => {
	ipcRenderer.send('logout');
});

document.getElementById('delete_data').addEventListener('click', () => { 
	ipcRenderer.send('delete_data');
	localStorage.removeItem('workDayData');
});