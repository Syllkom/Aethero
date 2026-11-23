# Configuración

Toda la configuración está en `config.js` (raíz). Se ejecuta **una vez** en el proceso padre y otra vez en el hijo, y deja sus valores en `global`.

## `global.config` ✅

Valores por defecto actuales de la rama `framework`:

| Clave | Por defecto | Efecto |
|---|---|---|
| `name` | `"Aethero"` | Nombre del bot; aparece como pie `@Aethero` en las respuestas interactivas. |
| `prefixes` | `".¿?¡!#%&/,~@"` | Cada carácter es un prefijo válido para comandos con `usePrefix: true`. |
| `saveHistory` | `true` | Guarda los mensajes (máx. 500 por usuario y chat) para `sock.loadMessage()` y para recuperar mensajes citados completos. |
| `autoRead` | `false` | Auto-lectura global. |
| `silentConsole` | `true` | Si es `true`, el handler de log no imprime mensajes. |
| `startupNotification` | `false` | Al conectar, envía un aviso al primer número de `userRoles`. |
| `alwaysOnline` | `false` | Presencia `available` permanente; si es `false` el bot se muestra `unavailable`. |
| `antiCall` | `true` | Rechaza llamadas entrantes salvo las de `antiCallWhitelist`. |
| `antiCallWhitelist` | `[""]` | Números o JIDs que pueden llamar. ⚠️ El valor por defecto es una cadena vacía, que coincide con **cualquier** llamante (`caller.includes("")` es siempre `true`). Déjalo como `[]` o con números reales. |
| `humanizer` | `false` | `true`: texto normal con "escribiendo…". `false`: respuestas interactivas. Ver [Primeros pasos](getting-started.md#dos-formas-de-responder). |
| `iconAI` | no definida | Si es `true`, los mensajes a chats privados llevan el nodo `biz_bot` (ícono de bot). |

> Nota: el README anterior documentaba `alwaysOnline: true` y `antiCall: false`, y no mencionaba `humanizer`. Los valores de arriba son los del código.

### Roles estáticos

```js
global.config.userRoles = {
    "51999999999": { root: true, owner: true, mod: true, vip: true }   // número o JID completo
}
```

En cada mensaje, estos roles se **fusionan sobre** los guardados en la base de datos y prevalecen. Ver [`m.sender`](message-object.md).

## Otras variables globales

| Variable | Contenido |
|---|---|
| `global.db` | Base de datos (HyperDB), con alcance por sub-bot. Ver [Almacenamiento](storage-and-auth.md). |
| `global.REACT_EMOJIS` | Alias → emoji para `m.react('wait' \| 'done' \| 'error')`. |
| `global.MSG` | Textos de `m.sms('root' \| 'owner' \| 'mod' \| 'vip' \| 'group' \| 'private' \| 'admin' \| 'botAdmin' \| 'unreg' \| 'restrict')`. |
| `global.PLUGINS_MSG`, `global.SCRAPERS_MSG` | Etiquetas de consola para plugins/scrapers nuevos, recargados o eliminados. ⚠️ Están definidas pero ningún archivo las usa hoy: no verás avisos al recargar. |
| `global.$dir_main` | Rutas absolutas: `plugins`, `handlers`, `creds`, `store`, `temp`. |
| `global.font` | URLs de fuentes para generar imágenes. |
| `global.readMore` | Cadena invisible para forzar "leer más". |
| `global.googleApiKey`, `global.danbooru` | Claves leídas de `.env`. |
| `global.scrapers` / `global.scraper` | Carpeta de scrapers del registro de módulos. |
| `global.sock` | Socket del bot principal (tras conectar). |
| `global.subbots` | Gestor de sub-bots. Ver [Sub-bots](subbots.md). |

## `MODULEREGISTRY` (`index.js`)

Define qué carpetas se vigilan, con qué sufijo y qué valores por defecto reciben sus módulos:

| Carpeta | Sufijo | Valores por defecto |
|---|---|---|
| `plugins/` | `.plugin.js` | `usePrefix: true`, `stubtype: false`, `command: false` |
| `handlers/` (**`mainLogic: true`**) | `.handler.js` | `enabled: true` |
| `library/scrapers/` | `.scraper.js` | `enable: true` |
| `library/` | `.extensions.js` | `enable: true` |
| `library/builders/` | `.builder.js` | `enable: true` |

Solo una carpeta puede llevar `mainLogic: true`: es la que ejecuta el pipeline de mensajes.

## Variables de entorno

| Variable | Uso |
|---|---|
| `GOOGLE_API_KEY`, `DANBOORU_LOGIN`, `DANBOORU_API_KEY` | Claves opcionales para plugins/scrapers. |
| `SESSION_NAME` | Solo la lee `hyperDBAdapter.js` para elegir la carpeta del store (`main` → `storage/store`, otro valor → `storage/subs/<valor>/store`). El framework no la define; normalmente no la necesitas. |
