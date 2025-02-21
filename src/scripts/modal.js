const { getClients } = require("../odoo/getClients");
const { ipcRenderer } = require('electron');

async function showClients() {
    try {
        const clients = await ipcRenderer.invoke('get-clients')
        console.log(clients); 

        const clientSelect = document.getElementById('client');

        if (!clients || clients.length === 0) {
            console.warn('No hay clientes disponibles.');
            clientSelect.innerHTML = '<option value="">No hay clientes disponibles</option>';
            return;
        }

        clientSelect.innerHTML = '';

        clients.forEach(client => {
            // Omitir cliente cuyo nombre sea un solo punto
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


document.addEventListener('DOMContentLoaded', () => {
    const closeButton = document.querySelector('#close');
    const button = document.querySelector('button');
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
        console.log('Datos enviados del formulario:', { client, description });
        // event.target.querySelector('input[name="description"]').value = '';
        
        // setTimeout(() => {
        //     document.getElementById('svg-loading').classList.add('no-loading');
        //     document.getElementById('svg-loading').classList.remove('loading');
        //     document.getElementById('button-text').style.display = 'block';
        // }, 5000);
        
        
        ipcRenderer.send('send-data', client, description);

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

        });
    
    });
    showClients();    

   
    closeButton.addEventListener('click', () => {
      ipcRenderer.send('close-modal-window');
    });

});