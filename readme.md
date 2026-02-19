# Time Tracker

![version](https://img.shields.io/badge/version-1.3.4-blue)
![fecha](https://img.shields.io/badge/fecha-2026--02--08-green)

## Cambios

- Cada tarea usa su propio tiempo de duración en lugar del tiempo global.
- Ajuste en la sincronización entre datos de Odoo y la información local.
- En pausa se detienen las notificaciones y se reanudan al cumplir el tiempo de la tarea.
- Estado de actualización visible en la interfaz con progreso de descarga.
- En actividad inactiva se envían `task_id` y `brand_id` como `false`.

## Compilación

```bash
npm run dist
```
