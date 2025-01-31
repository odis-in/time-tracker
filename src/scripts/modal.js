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

    document.getElementById('loginForm').addEventListener('submit', async (event) => { 
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const description = formData.get('description');
        const client = formData.get('client');
        console.log('Datos enviados del formulario:', { client, description });
        event.target.querySelector('input[name="description"]').value = '';
        ipcRenderer.send('send-data', client, description);
        
    
    });

    showClients();    

    const closeButton = document.getElementById('close');
    closeButton.addEventListener('click', () => {
      ipcRenderer.send('close-modal-window');
    });

});