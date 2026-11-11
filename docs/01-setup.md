# Guía de Configuración

Toda la configuración global del bot se maneja en el archivo `config.js` ubicado en la raíz del proyecto.

### Variables Principales

| Propiedad | Descripción | Valor por defecto |
| :--- | :--- | :--- |
| `name` | Nombre del bot que aparecerá en los mensajes. | "Aethero" |
| `prefixes` | Caracteres aceptados como prefijo para comandos. | ".¿?¡!#%&/,~@" |
| `saveHistory` | Guarda el historial de mensajes en HyperDB para funciones como Dump. | `true` |
| `humanicer` | Si es `true`, `m.reply` simula estar escribiendo. Si es `false`, usa la interfaz interactiva. | `true` |
| `alwaysOnline` | Mantiene el bot como "Disponible" 24/7. | `false` |
| `antiCall` | Rechaza llamadas entrantes automáticamente. | `true` |

### Configuración de Roles (Owners)
Para dar privilegios de owner a un número, agrégalo en el objeto `userRoles` dentro de tu `config.js`:

~~~javascript
global.config.userRoles = {
    "51904954450": { // Número sin + ni espacios
        root: true,
        owner: true,
        mod: true,
        vip: true
    }
}
~~~

### Variables de Entorno (.env)
Puedes crear un archivo `.env` en la raíz para mantener seguras tus claves de APIs sensibles (como las de búsqueda o scrapers):

~~~env
GOOGLE_API_KEY=""
DANBOORU_LOGIN=""
DANBOORU_API_KEY=""
~~~
