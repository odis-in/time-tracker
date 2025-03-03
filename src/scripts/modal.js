const { ipcRenderer, contextBridge } = require('electron');


ipcRenderer.on('timer-event', (event) => {
    const divPause = document.getElementsByClassName('pause');
    const closeButton = document.querySelector('#close');

    if (divPause.length > 0) {
        divPause[0].style.display = 'block';
        closeButton.style.display = 'none';
    }

    const pauseSelect = document.getElementById('pause');
    
    ipcRenderer.invoke('get-clients-and-pauses').then(({ pauses }) => {
        pauses.forEach(pause => {
            const option = document.createElement('option');
            option.value = pause.id;
            option.textContent = pause.name;
            pauseSelect.appendChild(option);
        });
    }).catch(error => {
        console.error('Error al obtener las pausas:', error);
    });
});

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




document.addEventListener('DOMContentLoaded', () => {
    const closeButton = document.querySelector('#close');
    const button = document.querySelector('button');
    const divPause = document.getElementsByClassName('pause');
    const pauseSelect = document.getElementById('pause');
    document.getElementById('loginForm').addEventListener('submit', async (event) => {
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

        }

        const formData = new FormData(event.target);
        const description = formData.get('description');
        const client = formData.get('client');
        const task = formData.get('task');
        const pause = formData.get('pause');
        console.log('Datos enviados del formulario:', { client, description, task, pause });
        // event.target.querySelector('input[name="description"]').value = '';

        // setTimeout(() => {
        //     document.getElementById('svg-loading').classList.add('no-loading');
        //     document.getElementById('svg-loading').classList.remove('loading');
        //     document.getElementById('button-text').style.display = 'block';
        // }, 5000);


        ipcRenderer.send('send-data', client, description, task, pause);

        ipcRenderer.once('send-data-response', () => {
            // Restaurar el botón cuando llegue la respuesta
            event.target.querySelector('input[name="description"]').value = '';
            document.getElementById('svg-loading').classList.add('no-loading');
            document.getElementById('svg-loading').classList.remove('loading');
            buttonText.style.display = 'block';
            closeButton.style.pointerEvents = 'auto'; // habilita clics en el SVG
            closeButton.style.opacity = '1';
            button.style.pointerEvents = 'auto';
            button.style.opacity = '1';
            divPause[0].style.display = 'none';
            pauseSelect.innerHTML = '';
            closeButton.style.display = 'block';
        });

    });
    showClients();


    closeButton.addEventListener('click', () => {
        ipcRenderer.send('close-modal-window');
    });

});