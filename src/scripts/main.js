const { ipcRenderer } = require('electron');

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
		const workDayData = await ipcRenderer.invoke('get-work-day')
		const tbody = document.getElementById('work-day-tbody');
		tbody.innerHTML = '';
	
		if (workDayData && workDayData.length > 0) {
			lastClient = null;
			lastRow = null;
			lastEndTime = null;

			workDayData.forEach((item, index) => {
				const row = document.createElement('tr');
				let startTime = item.startWork.split(' ')[1];
			
				let endTime;
				if (index < workDayData.length - 1) {
					endTime = workDayData[index + 1].startWork.split(' ')[1];
				} else {
					endTime = '00:00:00';
				}
			
				
				let timeWorked = calculateTimeDifference(startTime, endTime);
			
				if (lastClient === item.client) {
					
					startTime = lastRow.children[1].textContent;  registrada
					endTime = workDayData[index + 1].startWork.split(' ')[1];
					lastRow.children[2].textContent = endTime;
					lastRow.children[3].textContent = calculateTimeDifference(startTime, endTime);
			
				} else {
					
					row.innerHTML = `
						<td>${item.client}</td>
						<td>${startTime}</td>
						<td>${endTime}</td>
						<td>${timeWorked}</td>
					`;
					lastClient = item.client;   
					lastEndTime = endTime;      
					lastRow = row;              
				}
			
				tbody.appendChild(row);
			});
		} else {
			const emptyRow = document.createElement('tr');
			emptyRow.innerHTML = `<td colspan="4">No hay datos disponibles</td>`;
			tbody.appendChild(emptyRow);
		}
	} catch (error) {
		console.error('Error al cargar los datos de trabajo del día:', error);
	}
	
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

	loadWorkDayData();

	ipcRenderer.on('work-day-updated', () => {
		loadWorkDayData();
	});

});

document.getElementById('logout').addEventListener('click', () => {
	ipcRenderer.send('logout');
});


document.getElementById('delete_data').addEventListener('click', () => { 
	ipcRenderer.send('delete_data');
});