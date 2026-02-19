const { ipcRenderer, contextBridge } = require('electron');
const { systemLogger } = require('../utils/systemLogs');
const { validateTimeRange, applyHourValidation } = require('../utils/modal/validations');
const logger = systemLogger();
let timerEventData = null;
let currentError = false;
let prevHour = false;
function toggleAmPm(button) {
    if (button.textContent === 'AM') {
      button.textContent = 'PM';
    } else {
      button.textContent = 'AM';
    }
}

function onCurrentError(message) {
    const messageError = document.querySelector('#error-message');
    const button = document.querySelector('button');
    const buttonText = document.getElementById('button-text');
    const closeButton = document.querySelector('#close');
    document.getElementById('svg-loading').classList.add('no-loading');
    document.getElementById('svg-loading').classList.remove('loading');
    buttonText.style.display = 'block';
    button.style.pointerEvents = 'auto';
    button.style.opacity = '1';
    closeButton.style.pointerEvents = 'auto';
    closeButton.style.opacity = '1';
    messageError.textContent = message;
    ipcRenderer.send('error-modal', message);
}
ipcRenderer.on('error-occurred', (event, error) => {
    console.error('Error recibido desde el proceso principal:', error.message);
	console.error('Stack Trace:', error.stack);
	onCurrentError('Ha ocurrido un error. Inténtalo de nuevo.')
    ipcRenderer.send('error-modal', `Error: ${error.message}\nStack Trace: ${error.stack}`);
});

ipcRenderer.on('prev-hours', () => {
    const timeContainer = document.getElementsByClassName('time-container')
    timeContainer[0].classList.remove('hidden')
    prevHour = true;
    const timeInputs = document.querySelectorAll('.time-container input[type="text"]');
    timeInputs.forEach(input => {
        applyHourValidation(input);
    });
})

ipcRenderer.on('timer-event', async (event, data) => {
    console.log('timer-event', data);
    timerEventData = data;
    // const divPause = document.getElementsByClassName('pause');
    // document.querySelectorAll('.form-group:not(.pause)').forEach(el => {
    //     el.style.display = timerEventData === 'pause' ? 'none' : 'block';
    // });

    // if (divPause.length > 0) {
    //     divPause[0].style.display = 'block';
    // }

    // const pauseSelect = document.getElementById('pause');

    // ipcRenderer.invoke('get-clients-and-pauses').then(({ pauses }) => {
    //     pauses.forEach(pause => {
    //         const option = document.createElement('option');
    //         option.value = pause.id;
    //         option.textContent = pause.name;
    //         pauseSelect.appendChild(option);
    //     });
    // }).catch(error => {
    //     console.error('Error al obtener las pausas:', error);
    // });
});

async function showClients() {
    try {
        console.log('Obteniendo clientes...');
        const { clients } = await ipcRenderer.invoke('get-clients-and-pauses');
        const clientSelect = document.getElementById('client');
        const brandSelect = document.getElementById('brand');
        const taskSelect = document.getElementById('task');
        const descriptionInput = document.getElementById('description');
        if (!clients || clients.length === 0) {
            console.warn('No hay clientes disponibles.');
            clientSelect.innerHTML = '<option value="">No hay clientes disponibles</option>';
            taskSelect.innerHTML = '<option value="">No hay tareas disponibles</option>';
            brandSelect.innerHTML = '<option value="">No hay marcas disponibles</option>';
            return;
        }

        clientSelect.innerHTML = '';
        taskSelect.innerHTML = '<option value="">Selecciona una marca primero</option>';

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

            if (client.tasks.length === 0) {
                taskSelect.innerHTML = '<option value="">No hay tareas disponibles</option>';
            }
        });


        const updateBrands = (clientId) => {
            brandSelect.innerHTML = '';

            if (!clientId) {
                brandSelect.innerHTML = '<option value="">Selecciona un cliente primero</option>';
                return;
            }

            const selectedClient = clients.find(client => String(client.id) === String(clientId));
            selectedClient.brands.sort((a, b) => {
                if (a.name.toLowerCase() < b.name.toLowerCase()) {
                    return -1;  // a va antes que b
                }
                if (a.name.toLowerCase() > b.name.toLowerCase()) {
                    return 1;   // b va antes que a
                }
                return 0;     // son iguales
            });
            
            
            if (selectedClient && selectedClient.brands.length > 0) {
                selectedClient.brands.forEach(brand => {
                    const option = document.createElement('option');
                    option.value = String(brand.id);
                    option.textContent = brand.name;
                    brandSelect.appendChild(option);
                });
            } else {
                brandSelect.innerHTML = '<option value="">No hay marcas disponibles</option>';
            }

            if (selectedClient && selectedClient.tasks.length > 0) {
                taskSelect.innerHTML = '';
                selectedClient.tasks.forEach(task => {
                    if (brandSelect.value && brandSelect.value == task.brand_id || !task.brand_id) {
                        const option = document.createElement('option');
                        option.value = String(task.id);
                        option.textContent = task.name;
                        option.dataset.tag = task.task_tags;
                        taskSelect.appendChild(option);
                    }
                    
                });
            }
        };

        const updateTasks = (brandId) => {
            taskSelect.innerHTML = '';

            if (!brandId) {
                taskSelect.innerHTML = '<option value="">Selecciona una marca primero</option>';
                return;
            }

            const clientId = clientSelect.value;
            if (!clientId) {
                taskSelect.innerHTML = '<option value="">Selecciona un cliente primero</option>';
                return;
            }

            const selectedClient = clients.find(client => String(client.id) === String(clientId));
            if (selectedClient && selectedClient.tasks.length > 0) {
                selectedClient.tasks.forEach(task => {
                    if (brandId == task.brand_id || !task.brand_id) {
                        const option = document.createElement('option');
                        option.value = String(task.id);
                        option.textContent = task.name;
                        option.dataset.tag = task.task_tags;
                        taskSelect.appendChild(option);
                    } 

                });
            } else {
                taskSelect.innerHTML = '<option value="">No hay tareas disponibles</option>';
            }
        }

        // Evento para cambiar las marcas cuando se seleccione otro cliente
        clientSelect.addEventListener('change', () => {
            updateBrands(clientSelect.value);
        });

        brandSelect.addEventListener('change', () => {
            updateTasks(brandSelect.value);
        });

        taskSelect.addEventListener('change', () => {
            const selectedOption = taskSelect.options[taskSelect.selectedIndex];
            const tags = (selectedOption.dataset.tag || '').split(',').map(t => t.trim()).filter(Boolean);
            
            if (tags.length > 0) {
                tags.forEach(tag => {
                    if (tag.toLowerCase() == 'pausa' ) {
                        descriptionInput.removeAttribute('required');
                    } else {
                        descriptionInput.setAttribute('required', '1');
                    }
                    
                });
            }
        });

        // Seleccionar correctamente el cliente si hay uno guardado
        if (lastClient) {
            clientSelect.value = String(lastClient.id);
            updateBrands(lastClient.id);
        } else if (firstValidClient) {
            clientSelect.value = String(firstValidClient.id);
            updateBrands(firstValidClient.id);
        }

    } catch (error) {
        console.error('Error al obtener los clientes:', error);
        document.getElementById('client').innerHTML = '<option value="">Error al cargar los clientes</option>';
    }
}


document.addEventListener('DOMContentLoaded', () => {
    
    window.addEventListener('storage', (event) => {
        if (event.key === 'name') {
            showClients();	
        }
	});

    const closeButton = document.querySelector('#close');
    const button = document.querySelector('button');
    const divPause = document.getElementsByClassName('pause');
    const pauseSelect = document.getElementById('pause');
    const messageError = document.querySelector('#error-message');
    document.getElementById('modalForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const svgElement = document.getElementById('svg-loading');
        const buttonText = document.getElementById('button-text');



        if (svgElement) {
            svgElement.classList.add('loading');
            svgElement.classList.remove('no-loading');
            buttonText.style.display = 'none';
            closeButton.style.pointerEvents = 'none'; // Bloquea clics en el SVG
            closeButton.style.opacity = '0.5'; // Opcional: lo hace visualmente "deshabilitado"
            button.style.opacity = '0.5'; // Opcional: lo hace visualmente "deshabilitado"
            button.style.pointerEvents = 'none'; // Deshabilita el botón
            messageError.textContent = ''; 

        }

        const formData = new FormData(event.target);
        
        const data = {
            client: formData.get('client'),
            description: formData.get('description'),
            brand: formData.get('brand'),
            task: formData.get('task'),
            pause: formData.get('pause'),
        };

        const taskSelect = document.querySelector('[name="task"]');
        const selectedOption = taskSelect.options[taskSelect.selectedIndex];
        const tags = (selectedOption.dataset.tag || '')
            .split(',')
            .map(t => t.trim())
            .filter(Boolean);

        if (tags.length > 0) {
            tags.forEach(tag => {
                if (tag.toLowerCase() == 'pausa' && timerEventData != 'resume') {
                    timerEventData = 'pause'
                }
            });
        }
        
        if (prevHour){

            const { dateInit, dateEnd } = validateTimeRange(formData.get('time_start'), formData.get('time_end'))
            
            data.regPrevHour = {
                timeStart: dateInit.toISOString().replace('T',' ').substring(0, 19),
                timeEnd: dateEnd.toISOString().replace('T',' ').substring(0, 19),
            };
        }
        
        ipcRenderer.send('send-data', data);
        ipcRenderer.send('change-timer-status', timerEventData);
        ipcRenderer.once('send-data-response', () => {
            event.target.querySelector('input[name="description"]').value = '';
            timerEventData = null; //reinicio timer-event
            document.getElementById('svg-loading').classList.add('no-loading');
            document.getElementById('svg-loading').classList.remove('loading');
            buttonText.style.display = 'block';
            closeButton.style.pointerEvents = 'auto'; 
            closeButton.style.opacity = '1';
            button.style.pointerEvents = 'auto';
            button.style.opacity = '1';
            divPause[0].style.display = 'none';
            pauseSelect.innerHTML = '';

            const timeContainer = document.getElementsByClassName('time-container')
            timeContainer[0].classList.add('hidden')
            const timeInputs = document.querySelectorAll('.time-container input[type="text"]');
            timeInputs.forEach(input => input.value = '');
            prevHour = false;
        });
    });
    
    showClients();

    
    closeButton.addEventListener('click', (event) => {
        const data = JSON.parse(localStorage.getItem('workDayData'))
        lastClient = data.pop();
        ipcRenderer.send('close-modal-window');
        document.querySelector('input[name="description"]').value = '';
        document.querySelector('select[name="client"]').value = lastClient.client.id;
        divPause[0].style.display = 'none';
        pauseSelect.innerHTML = '';
        timerEventData = null;
        document.querySelectorAll('.form-group:not(.pause)').forEach(el => {
            el.style.display = 'block';
        });

        const timeContainer = document.getElementsByClassName('time-container')
        timeContainer[0].classList.add('hidden')
        const timeInputs = document.querySelectorAll('.time-container input[type="text"]');
        timeInputs.forEach(input => input.value = '');
        prevHour = false;
        const messageError = document.querySelector('#error-message');
        messageError.textContent = '';
        currentError = false;
        showClients();     
    });

});