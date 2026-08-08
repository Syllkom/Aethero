# Aethero

> Framework **event-driven** y **modular** para bots de WhatsApp construido sobre [Baileys](https://github.com/WhiskeySockets/Baileys), con **aislamiento de procesos** (padre/hijo vía `fork`) y un **pipeline de handlers encadenados** por prioridad.

- **Nombre del paquete:** `Aethero`
- **Autor:** Syllkom
- **Licencia:** MIT
- **Node.js:** `>= 18.0.0`
- **Tipo de módulo:** ESM (`"type": "module"`)
- **Repositorio:** `git+https://github.com/Syllkom/Aethero.git`

---

## Índice

1. [Descripción general](#1-descripción-general)
2. [Arquitectura](#2-arquitectura)
3. [Estructura de carpetas](#3-estructura-de-carpetas)
4. [Instalación y arranque](#4-instalación-y-arranque)
5. [Configuración global (`config.js`)](#5-configuración-global-configjs)
6. [Flujo de arranque](#6-flujo-de-arranque)
7. [Librería núcleo (`core/library`)](#7-librería-núcleo-corelibrary)
8. [Pipeline de handlers](#8-pipeline-de-handlers)
9. [Objeto de mensaje `m` — Referencia completa](#9-objeto-de-mensaje-m--referencia-completa)
10. [Sistema de plugins](#10-sistema-de-plugins)
11. [Roles y permisos](#11-roles-y-permisos)
12. [Dependencias principales](#12-dependencias-principales)
13. [Ejemplo práctico: crear un plugin](#13-ejemplo-práctico-crear-un-plugin)
14. [Notas técnicas y observaciones](#14-notas-técnicas-y-observaciones)

---

## 1. Descripción general

**Aethero** es un framework base para construir bots de WhatsApp. Sus características principales son:

- **Conexión a WhatsApp** mediante `@whiskeysockets/baileys`, soportando login por **código QR** o por **código de emparejamiento (pin de 8 dígitos)**.
- **Aislamiento de procesos:** el proceso principal (`index.js`) nunca ejecuta la lógica del bot directamente; en su lugar, lanza un **proceso hijo** (`core/main.js`) mediante `child_process.fork`. Si el hijo se cae, el padre lo reinicia automáticamente.
- **Carga dinámica de módulos con hot-reload:** los `handlers/` y `plugins/` se observan en disco (`chokidar`) y se recargan en caliente sin reiniciar el bot.
- **Pipeline de mensajes por prioridad:** cada mensaje entrante pasa por una cadena ordenada de "handlers", cada uno añadiendo información al objeto de mensaje (`this`/`m`): datos del bot, del chat, del remitente, del contenido, del mensaje citado, logging, y finalmente el enrutamiento a un **plugin/comando**.

---

## 2. Arquitectura

```
index.js (proceso PADRE)
   │
   │  usa
   ▼
core/index.js → CoreI ──(fork)──► core/main.js (proceso HIJO)
                                        │
                                        ├─ WAClient.js  → conecta con WhatsApp (Baileys)
                                        ├─ ModuleRegistry → carga y observa handlers/ y plugins/
                                        └─ Pipeline de mensajes → ejecuta handlers en orden
                                                                → handler "plugins" enruta a un comando
```

**¿Por qué dos procesos?**

- **Aislamiento de memoria:** el hijo se lanza con `--max-old-space-size=512`, limitando su consumo de RAM.
- **Resiliencia:** si el hijo termina (crash, `exit`), el padre (`CoreI`) espera 2 segundos y lo reinicia automáticamente (ver `core/index.js`).
- **Comunicación:** el hijo usa `process.send(update)` para notificar al padre eventos de conexión (`open`, `close`, `pairing`, etc.), y el padre reenvía las credenciales (`env`) serializadas en JSON al hijo al iniciarlo.

---

## 3. Estructura de carpetas

```
Simple WABase/
├── core/
│   ├── library/
│   │   ├── MakeFork.js      # Gestor de procesos hijo (child_process.fork)
│   │   ├── Message.js       # Resolución/clasificación de mensajes de Baileys
│   │   ├── Modules.js       # Carga dinámica de módulos (handlers/plugins)
│   │   ├── pathStore.js     # Estructura tipo árbol para indexar rutas de archivos
│   │   ├── Question.js      # Utilidad de prompts interactivos por consola
│   │   ├── WAClient.js      # Wrapper de conexión a Baileys (QR / pin-code)
│   │   └── Watcher.js       # Observador de carpetas (chokidar) + almacén de archivos
│   ├── format.js            # Esquema/plantilla de referencia del objeto de mensaje
│   ├── index.js             # Clase CoreI: proceso padre, gestiona el fork
│   └── main.js               # Proceso hijo: conecta WhatsApp y ejecuta el pipeline
├── handlers/
│   ├── func.log.handler.js         # Logging de cada mensaje en consola
│   ├── func.plugins.handler.js     # Enrutador de comandos → ejecuta plugins
│   ├── m.bot.handler.js            # Añade info del propio bot al mensaje
│   ├── m.chat.handler.js           # Añade info del chat/grupo al mensaje
│   ├── m.content.handler.js        # Extrae texto/medios del mensaje
│   ├── m.sender.handler.js         # Añade info del remitente
│   ├── quoted.chat.handler.js      # Info de chat del mensaje citado
│   └── quoted.sender.handler.js    # Info de remitente del mensaje citado
├── config.js                 # Configuración global (prefijos, roles, mensajes, rutas)
├── index.js                  # Punto de entrada del proyecto
└── package.json
```

> **Nota:** el registro de módulos (`index.js`) también espera una carpeta `plugins/` (con sufijo `.plugin.js`) que no aparece en este snapshot del proyecto, pero es donde se deben colocar los comandos del bot (ver [sección 10](#10-sistema-de-plugins)).

---

## 4. Instalación y arranque

### Requisitos
- Node.js `>= 18`
- `ffmpeg` (se instala automáticamente vía `ffmpeg-static`)

### Scripts disponibles (`package.json`)

| Script | Comando | Descripción |
|---|---|---|
| `start` | `node index.js` | Inicia el bot |
| `build` | `npm install && node index.js` | Instala dependencias e inicia el bot |

### Variables de entorno (`.env`)

El proyecto usa `dotenv`. Variable detectada en `config.js`:

```env
GOOGLE_API_KEY=tu_api_key_de_google
```

### Primer arranque

Al ejecutar `npm start` por primera vez (sin credenciales guardadas en `storage/creds/creds.json`), el bot lanza un menú interactivo por consola (`Question.js` → `PromptLoop`):

```
~> ¿Cómo desea conectarse?
1. Código QR.
2. Código de 8 dígitos.
Escriba "exit" para cancelar.
```

- **Opción 1:** genera un código QR en la terminal para escanear desde WhatsApp.
- **Opción 2:** solicita un número de teléfono y genera un código de emparejamiento de 8 dígitos.

Las credenciales se guardan en `storage/creds/`, por lo que en arranques posteriores este menú no vuelve a aparecer.

---

## 5. Configuración global (`config.js`)

Este archivo se ejecuta antes que cualquier otra cosa (`index.js` hace `await import('./config.js')` como primera línea) y define **variables globales** (`global.*`) usadas en todo el proyecto.

| Variable global | Tipo | Descripción |
|---|---|---|
| `global.googleApiKey` | `string` | Toma el valor de `process.env.GOOGLE_API_KEY`. |
| `global.readMore` | `string` | Cadena de 850 caracteres invisibles (código `8206`), típicamente usada para forzar el botón "leer más" en mensajes largos de WhatsApp. |
| `global.config` | `object` | Configuración base del bot (ver abajo). |
| `global.config.userRoles` | `object` | Mapa de `número de teléfono → roles` (ver [Roles y permisos](#11-roles-y-permisos)). |
| `global.REACT_EMOJIS` | `object` | Emojis usados como reacciones de estado: `wait`, `done`, `error`. |
| `global.MSG` | `object` | Mensajes de error/restricción predefinidos (permisos, registro, etc.), en español. |
| `global.PLUGINS_MSG` | `object` | Mensajes de consola (con color `chalk`) para eventos de carga de plugins: nuevo, recargado, eliminado. |
| `global.$dir_main` | `object` | Rutas absolutas resueltas para: `plugins`, `handlers`, `creds`, `store`, `temp`. |

### `global.config`

```js
global.config = {
    name: "Aethero",                 // Nombre del bot
    prefixes: ".¿?¡!#%&/,~@",    // Caracteres válidos como prefijo de comando
    saveHistory: true,
    autoRead: true
};
```

### `global.MSG` (mensajes de restricción)

| Clave | Uso previsto |
|---|---|
| `root` | Comando solo para el dueño del bot |
| `owner` | Comando solo para "propietarios" |
| `mod` | Comando solo para moderadores |
| `vip` | Función solo para usuarios premium |
| `group` | Comando solo usable en grupos |
| `private` | Comando solo usable en chat privado |
| `admin` | Comando solo para admins del grupo |
| `botAdmin` | El bot necesita ser admin del grupo |
| `unreg` | Usuario no registrado |
| `restrict` | Función desactivada |

---

## 6. Flujo de arranque

### 6.1 `index.js` (raíz) — Punto de entrada

```js
await import('./config.js')          // 1. Carga configuración global

const bot = new CoreI(null, {         // 2. Instancia el gestor del proceso padre
    STORAGE: path.resolve('./storage'),
    CONFIG: path.resolve('./config.js'),
    MODULEREGISTRY: [
        { folder: './plugins',  suffix: '.plugin.js',  defaultContext: { usePrefix: true, stubtype: false, command: false } },
        { mainLogic: true, folder: './handlers', suffix: '.handler.js', defaultContext: { enabled: true } }
    ]
})

await bot.start()                     // 3. Arranca el fork (proceso hijo)
```

`MODULEREGISTRY` define qué carpetas se observan y cómo se interpretan sus archivos. El módulo marcado con `mainLogic: true` (`handlers/`) es el que ejecuta el pipeline principal de mensajes.

### 6.2 `core/index.js` — Clase `CoreI` (proceso padre)

Gestiona el ciclo de vida del proceso hijo mediante `ForkManager`.

| Método | Descripción |
|---|---|
| `constructor(modulePath, env, options)` | `modulePath` por defecto es `./core/main.js`. |
| `start()` | Si no hay `connOptions.connectType` en `env`, lanza el menú interactivo (`Prompt()`) para elegir QR o pin-code. Luego crea el `ForkManager` y arranca el hijo con `--max-old-space-size=512`. |
| `stop()` | Detiene el proceso hijo. |
| `Event()` | Registra 3 listeners sobre el fork: `message` (reenvía eventos de conexión a consola), `exit` (espera 2s y reinicia el fork automáticamente), `error`. |

**Ejemplo de uso:**

```js
import { CoreI } from './core/index.js';

const bot = new CoreI(null, {
    STORAGE: path.resolve('./storage'),
    CONFIG: path.resolve('./config.js'),
    MODULEREGISTRY: [/* ... */]
});

await bot.start();   // arranca el proceso hijo (o pregunta QR/pin si es la primera vez)
// ...
await bot.stop();    // detiene el bot
```

### 6.3 `core/main.js` — Proceso hijo (lógica real del bot)

Este es el script que corre **dentro** del proceso hijo:

1. Reconstruye `env` parseando las variables de entorno (que llegan serializadas en JSON desde el padre).
2. Crea las carpetas `storage/`, `storage/creds`, `storage/store`, `storage/temp`.
3. Importa dinámicamente `env.CONFIG` (o sea, `config.js`).
4. Valida que exista `env.MODULEREGISTRY` y que al menos un módulo tenga `mainLogic: true`.
5. Instancia `ModuleRegistry` (carga y observa `handlers/` y `plugins/`).
6. Instancia `MakeClient` y se conecta a WhatsApp (`mainBot.start(...)`).
7. Escucha el evento `messages` de Baileys: por cada mensaje entrante:
   - Resuelve el tipo real de mensaje con `resolveMessage()` (desenrolla wrappers como `viewOnceMessage`, `ephemeralMessage`, etc.).
   - Construye el objeto `m` base (`key`, `message`, `raw`, `id`, `category`, `type`, `messageData`, `contextInfo`, `messageTimestamp`, `broadcast`, `pushName`).
   - Si el mensaje cita a otro (`contextInfo.quotedMessage`), construye `m.quoted` con la misma estructura.
   - Obtiene los handlers activos (`enabled: true`) de la carpeta `handlers`, los **ordena por `priority` ascendente** y los ejecuta secuencialmente con `handler.script.call(m, { sock, control, modules })`.
   - Un handler puede detener el pipeline seteando `control.end = true`.
   - Si ocurre un error Boom con código `428` (sesión inválida), reinicia el cliente automáticamente.
8. Escucha el evento `call`: **rechaza automáticamente** cualquier llamada entrante (`sock.rejectCall`).

---

## 7. Librería núcleo (`core/library`)

### 7.1 `WAClient.js` — `MakeClient`

Envuelve la conexión con Baileys.

**Configuración de conexión por defecto (`CONNECTION`):** incluye timeouts, `patchMessageBeforeSending` (añade un `messageSecret` aleatorio a cada mensaje saliente), reintentos de transacción, verificación de `appState`, etc.

**Función interna `StartBot(object)`:**
- Usa `useMultiFileAuthState` para persistir credenciales en disco.
- Si `connectType === 'pin-code'`, solicita un código de emparejamiento (`sock.requestPairingCode`) para el número indicado.
- Escucha `connection.update` de Baileys y clasifica el motivo de desconexión:

| Situación | Acción |
|---|---|
| `restartRequired`, `connectionLost`, `connectionClosed`, `unavailableService`, `timedOut` | Emite `restart` y reconecta automáticamente con QR |
| `loggedOut`, `badSession`, `multideviceMismatch`, `forbidden` | Emite `closed`, **borra la carpeta de credenciales** y resuelve `null` |
| `connectionReplaced` | Emite `replaced` (sesión abierta en otro lado) |
| Cualquier otro motivo | Emite `error` y reintenta con QR tras 5s |
| `connection === 'open'` | Emite `open` con los datos del bot (`lid`, `id`) |
| Se recibe `qr` | Emite `pairing` / `qr-code` con la imagen y el texto ASCII del QR |

**Clase `MakeClient`:**

| Método | Descripción |
|---|---|
| `start(options)` | Conecta y devuelve el socket de Baileys (`sock`). |
| `stop()` | Cierra la conexión y remueve listeners. |
| `restart()` | Detiene y vuelve a conectar (modo QR). |
| `logged()` | Cierra sesión (`logout`) y detiene el cliente. |

**Ejemplo de uso (fuera del pipeline, uso directo):**

```js
import { MakeClient } from './core/library/WAClient.js';

const client = new MakeClient();

client.events.on('connection', (update) => {
    if (update.type === 'pairing' && update.event === 'qr-code') {
        console.log(update.data.qrCodeText);   // imprime el QR en la terminal
    }
    if (update.type === 'open') {
        console.log('Conectado como:', update.data.id);
    }
});

client.events.on('messages', (raw) => {
    console.log('Mensajes entrantes:', raw.messages.length);
});

const sock = await client.start({
    folderPath: './storage/creds',
    connectType: 'qr-code'          // o 'pin-code' + phoneNumber
});

// Más tarde...
await client.restart();   // reconectar
await client.logged();    // cerrar sesión definitivamente
```

### 7.2 `MakeFork.js` — `ForkManager`

Envuelve `child_process.fork` con una interfaz de eventos simplificada.

```js
const proc = new ForkManager('./core/main.js', {
    execArgv: ['--max-old-space-size=512'],
    env: { STORAGE: '...', CONFIG: '...', MODULEREGISTRY: [...] }
});

proc.event.set('message', async (m, fork) => { /* ... */ });
proc.event.set('exit', async ({ code, signal }, fork) => { /* ... */ });
proc.event.set('error', (e, fork) => { /* ... */ });

await proc.start();
proc.send({ hola: 'mundo' });   // process.send hacia el hijo
proc.uptime;                    // ms desde que arrancó
```

Nota importante: antes de lanzar el fork, `start()` clona `options` con `structuredClone` y **serializa cada valor de `env` con `JSON.stringify`**, ya que las variables de entorno de un proceso solo pueden ser strings.

### 7.3 `Modules.js` — `ModuleFolder` y `ModuleRegistry`

Sistema de carga dinámica de archivos `.js` con **cache-busting** (cada import añade `?update=timestamp` a la URL para evitar el caché de módulos de Node).

**`ModuleFolder`** (una instancia por carpeta observada):

| Método | Descripción |
|---|---|
| `file(path)` | Devuelve el módulo por su ruta relativa (ya sea un archivo con el sufijo registrado, ej. `.plugin.js`, o un `.js` normal). |
| `folder(path)` | Lista el contenido (archivos/carpetas) de una subcarpeta indexada. |
| `import(query)` | Importa por nombre exportado (`string`) o por archivo (`{file: 'ruta'}`). |
| `export(key, value)` | Registra/mezcla un valor exportado manualmente. |
| `query(criteria)` | Busca módulos cuyo contenido coincide con `criteria` (soporta comparación exacta, `RegExp`, arrays e igualdad profunda vía `matchValue`). Usado por `func.plugins.handler.js` para encontrar el plugin que corresponde a un comando. |
| `ImportFile(filePath)` | (Re)importa un archivo, separando si es un archivo "de sufijo" (ej. `.handler.js`/`.plugin.js`, exportación por defecto) o un `.js` auxiliar. |
| `removeFile(filePath)` | Elimina un archivo del registro interno. |

**`ModuleRegistry`**: coordina varias `ModuleFolder`, una por cada carpeta definida en `MODULEREGISTRY`, y crea un `Watcher` compartido que reacciona a los eventos `add`/`change`/`unlink` del sistema de archivos delegando a la `ModuleFolder` correspondiente.

```js
const modules = await new ModuleRegistry([
  { folder: './plugins', suffix: '.plugin.js', defaultContext: { usePrefix: true, command: false } },
  { folder: './handlers', suffix: '.handler.js', defaultContext: { enabled: true }, mainLogic: true }
]).start();

modules.getFolder('plugins');   // → instancia ModuleFolder de ./plugins
modules.folders;                // → { plugins: ModuleFolder, handlers: ModuleFolder }
```

### 7.4 `Watcher.js` — `Watcher` y `StoreColl`

- **`Watcher`**: envuelve `chokidar.watch` sobre una o varias carpetas (`depth: 99`, `awaitWriteFinish: true`) y expone `start()`/`stop()`. Emite hacia `eventHandler.add/change/unlink` con la ruta completa, la ruta relativa y el `pathStore` correspondiente.
- **`StoreColl`**: colección de un `pathStore` por carpeta observada; permite ubicar a qué carpeta pertenece un archivo (`findStore`) y sincronizar su índice (`getFile`, `setFile`, `deleteFile`).

**Ejemplo de uso:**

```js
import { Watcher } from './core/library/Watcher.js';

const watcher = new Watcher(['./plugins', './handlers'], {
    add:    async (filePath, relative, store) => console.log('Nuevo archivo:', relative),
    change: async (filePath, relative, store) => console.log('Archivo modificado:', relative),
    unlink: (filePath, relative, store)       => console.log('Archivo eliminado:', relative),
});

await watcher.start();   // resuelve cuando chokidar termina el escaneo inicial ('ready')

// listar archivos ya indexados de una carpeta:
const store = watcher.storeManag.getStore('./plugins');
console.log(store.keys());

await watcher.stop();
```

### 7.5 `pathStore.js` — `PathTree` y `pathStore`

Estructura tipo **árbol de rutas** (similar a un trie por segmentos de carpeta) usada para poder consultar rápidamente el "listado de una carpeta" (`folder(path)` en `ModuleFolder`). Cada segmento de ruta se mapea a un `Set` de sus hijos directos; las rutas "hoja" (archivos) se marcan con el valor `1`.

Métodos principales de `pathStore`: `set`, `get`, `has`, `delete`, `isLeaf`, `keys`, `values`, `entries`, `forEach`, `toObject`.

**Ejemplo de uso:**

```js
import { pathStore } from './core/library/pathStore.js';

const store = new pathStore();

store.set('comandos/admin/ban.plugin.js');
store.set('comandos/admin/kick.plugin.js');
store.set('comandos/ping.plugin.js');

store.get('comandos');              // → ['admin', 'ping.plugin.js']
store.get('comandos/admin');        // → ['ban.plugin.js', 'kick.plugin.js']
store.isLeaf('comandos/ping.plugin.js'); // → true (es un archivo, no una carpeta)
store.has('comandos/admin');        // → true

store.delete('comandos/admin/ban.plugin.js');
store.get('comandos/admin');        // → ['kick.plugin.js']
```

### 7.6 `Message.js` — Resolución de mensajes de Baileys

```js
export const CATEGORIES = { 1: 'CONTENT', 0: 'SYSTEM', W: 'WRAPPER' };
```

- **`WRAPPER_TYPES`**: tipos que envuelven a otro mensaje real (`ephemeralMessage`, `viewOnceMessage`, `viewOnceMessageV2`, `editedMessage`, etc.).
- **`SYSTEM_TYPES`**: tipos de sistema/protocolo que no son contenido visible para el usuario (`protocolMessage`, `call`, notificaciones de estado, etc.).
- **`resolveMessage(msg)`**: dado el objeto `message` crudo de Baileys, **desenvuelve recursivamente** los wrappers hasta llegar al tipo de contenido real, y devuelve `{ category, type, messageData }`.

Esto es lo que permite que `core/main.js` obtenga el tipo/contenido real de un mensaje, sin importar cuántas capas de "ephemeral"/"viewOnce" lo envuelvan.

**Ejemplo de uso:**

```js
import { resolveMessage } from './core/library/Message.js';

// rawMessage.message viene directo del evento 'messages.upsert' de Baileys
const { category, type, messageData } = resolveMessage(rawMessage.message);

console.log(category);     // 'CONTENT' | 'SYSTEM' | 'UNKNOWN'
console.log(type);         // ej. 'imageMessage', 'conversation', 'extendedTextMessage'...
console.log(messageData);  // el objeto de datos ya desenvuelto (sin wrappers)
```

Ejemplo real: un mensaje "de visualización única" (`viewOnceMessageV2`) que contiene una imagen se resolvería así:

```
Entrada:  { viewOnceMessageV2: { message: { imageMessage: { ... } } } }
Salida:   { category: 'CONTENT', type: 'imageMessage', messageData: { ... } }
```

### 7.7 `Question.js` — `PromptLoop`

Utilidad de consola interactiva usada durante el primer arranque para elegir el método de conexión.

```js
const menu = PromptLoop(['Pregunta:', '> ']);
const respuesta = await menu.run(async function (input) {
    if (input === 'salir') return this.close();       // termina el loop
    if (input === 'ok')    return this.resolve('valor'); // resuelve con un valor
    return this.continue();                             // vuelve a preguntar
});
```

---

## 8. Pipeline de handlers

Cada mensaje entrante ejecuta, **en orden ascendente de `priority`**, todos los handlers de `handlers/` con `enabled: true`. Cada uno recibe `this` como el objeto de mensaje `m` y `{ sock, control, modules }` como argumento.

| Orden | Archivo | `priority` | Qué añade a `m` |
|---|---|---|---|
| 1 | `m.content.handler.js` | `0.02` | `m.content` — texto y medios del mensaje (y de `m.quoted.content` si aplica) |
| 2 | `m.bot.handler.js` | `0.1` | `m.bot` — identidad del propio bot |
| 3 | `m.chat.handler.js` | `0.11` | `m.chat` — datos del chat/grupo |
| 4 | `m.sender.handler.js` | `0.12` | `m.sender` — datos de quien envía el mensaje |
| 5 | `quoted.chat.handler.js` | `1.1` | `m.quoted.chat` — datos del chat del mensaje citado |
| 6 | `quoted.sender.handler.js` | `1.2` | `m.quoted.sender` — datos del remitente del mensaje citado |
| 7 | `func.log.handler.js` | `2.21` | Imprime un log coloreado del mensaje en consola |
| 8 | `func.plugins.handler.js` | `Infinity` | Parsea el comando (prefijo, `tag=`, args) y **ejecuta el plugin** correspondiente |

### Detalle de cada handler

- **`m.content.handler.js`**: detecta si el mensaje es de tipo media (`imageMessage`, `videoMessage`, `audioMessage`, `documentMessage`) y extrae el texto según el tipo (`conversation`, `imageMessage.caption`, `extendedTextMessage.text`, respuestas de botones/listas interactivas, etc.). Expone `m.content.media.download(type)` para descargar el archivo adjunto. Repite la misma lógica para `m.quoted` si existe.
- **`m.bot.handler.js`**: arma `m.bot` con `id` (formato `@lid`), `user` (mención `@numero`), `number`, `name` y si el mensaje `fromMe`. También expone `m.bot.isAdmin` (getter) si el chat es grupo.
- **`m.chat.handler.js`** / **`quoted.chat.handler.js`**: exponen `id`, `isGroup`, `metaData()` (obtiene y cachea los metadatos del grupo vía `sock.groupMetadata`), y getters derivados: `size`, `desc`, `name`, `created`, `participants`, `owner`, `admins`. **Importante:** los getters dependen de haber llamado antes a `metaData()`, de lo contrario devuelven `undefined`.
- **`m.sender.handler.js`** / **`quoted.sender.handler.js`**: identifican al remitente (`id` en formato `@lid`, `number`, `user`, `mentioned`, `name`) y exponen `isAdmin` (getter, requiere metadata de grupo ya cargada).
- **`func.log.handler.js`**: imprime en consola, con `chalk`, la hora, el texto/tipo del mensaje, el remitente y si el chat es grupal o privado.
- **`func.plugins.handler.js`**: es el **enrutador de comandos**. Ver [sección 10](#10-sistema-de-plugins).

Un handler puede **detener la cadena** seteando `control.end = true` desde su `script`.

---

## 9. Objeto de mensaje `m` — Referencia completa

`core/format.js` documenta la forma base del mensaje (usada como referencia/plantilla, no se importa en el código de ejecución). Combinando esa base con lo que añade cada handler, el objeto `m` disponible en un plugin queda así:

```js
m = {
  // --- Base (core/main.js) ---
  key, message, raw, id, category, type,
  messageData, contextInfo, messageTimestamp, broadcast, pushName,

  quoted: {                       // solo si el mensaje cita a otro
    key, message, raw, id, category, type,
    messageData, contextInfo, quotedType,
    chat: { id, isGroup, metaData(), size, desc, name, created, participants, owner, admins },
    sender: { id, number, user, isAdmin },
    content: { isMedia, text, args, media: { mimeType, fileName, download() } }
  },

  // --- Añadido por handlers ---
  bot:     { id, user, number, name, fromMe, isAdmin },
  chat:    { id, isGroup, metaData(), size, desc, name, created, participants, owner, admins },
  sender:  { id, number, mentioned, name, user, isAdmin },
  content: { isMedia, text, args, media: { mimeType, fileName, download() } },

  // --- Añadido por func.plugins.handler.js ---
  body, tag, text, args, command, isCmd, plugin
}
```

---

## 10. Sistema de plugins

Los **plugins** son los "comandos" del bot. Se colocan en la carpeta `plugins/` (definida en `MODULEREGISTRY` de `index.js`) con el sufijo `.plugin.js`, y se cargan/observan igual que los handlers.

### Contexto por defecto de un plugin

```js
{ usePrefix: true, stubtype: false, command: false }
```

### Cómo los enruta `func.plugins.handler.js`

1. Toma `this.content.text` como `body`.
2. Extrae etiquetas `tag=algo` del texto (para metadatos, no afectan el comando).
3. Según si el primer carácter del texto está entre los prefijos configurados (`global.config.prefixes`), determina el `command` (primera palabra, en minúsculas, sin el prefijo) y busca en `plugins` con `query({ case: command, usePrefix: true|false, command: true })`.
4. Si encuentra un plugin coincidente, lo guarda en `this.plugin` y `this.isCmd = true`.
5. Ejecuta `this.plugin.script(this, { plugins, sock })`.

### Forma de un archivo `.plugin.js`

```js
// ./plugins/ping.plugin.js
export default {
    case: 'ping',        // nombre del comando
    command: true,       // obligatorio: marca el archivo como comando
    usePrefix: true,      // si requiere el prefijo configurado (ej. ".ping")
    script: async (m, { plugins, sock }) => {
        await sock.sendMessage(m.chat.id, { text: 'pong 🏓' }, { quoted: m.raw });
    }
}
```

> `plugins.query(criteria)` acepta también arrays (`case: ['ping', 'p']`) o expresiones regulares gracias a `matchValue()` en `ModuleFolder`.

---

## 11. Roles y permisos

`global.config.userRoles` mapea **número de teléfono → objeto de roles**:

```js
global.config.userRoles = {
    "5216678432366": {
        root: true,
        owner: true,
        mod: true,
        vip: true
    }
}
```

Un plugin puede verificar el rol del remitente así:

```js
script: async (m, { sock }) => {
    const roles = global.config.userRoles[m.sender.number] || {};
    if (!roles.owner) return sock.sendMessage(m.chat.id, { text: global.MSG.owner });
    // ... lógica restringida a propietarios
}
```

---

## 12. Dependencias principales

| Paquete | Propósito |
|---|---|
| `@whiskeysockets/baileys` | Cliente de WhatsApp Web (protocolo multi-dispositivo) |
| `@hapi/boom` | Manejo de errores HTTP/desconexión (`Boom`) |
| `chokidar` | Observación de archivos para hot-reload de handlers/plugins |
| `dotenv` | Carga de variables de entorno |
| `chalk` | Colores en consola |
| `pino` | Logger usado internamente por Baileys |
| `qrcode` / `qrcode-terminal` | Generación de código QR (imagen y ASCII) |
| `moment-timezone` | Formato de fechas/horas en logs |
| `jimp` | Procesamiento de imágenes |
| `ffmpeg-static` / `fluent-ffmpeg` | Procesamiento de audio/video |
| `axios` / `got` | Peticiones HTTP |
| `cheerio` | Parseo/scraping de HTML |
| `node-cache` | Caché en memoria |
| `lodash` | Utilidades generales |
| `express` | Servidor HTTP (para funciones que expongan endpoints) |
| `@google/generative-ai`, `openai`, `@cerebras/cerebras_cloud_sdk` | Integraciones con IA generativa |
| `@syllkom/hyper-db` | Base de datos (uso previsto en plugins, no presente en este snapshot) |
| `@adiwajshing/keyed-db` | Base de datos indexada en memoria |

---

## 13. Ejemplo práctico: crear un plugin

**Objetivo:** un comando `.saludo` que responde con el nombre de quien lo ejecuta, solo disponible para usuarios registrados como `vip` en grupos.

```js
// ./plugins/saludo.plugin.js
export default {
    case: 'saludo',
    command: true,
    usePrefix: true,
    script: async (m, { sock }) => {

        // Solo en grupos
        if (!m.chat.isGroup) {
            return sock.sendMessage(m.chat.id, { text: global.MSG.group }, { quoted: m.raw });
        }

        // Solo VIP
        const roles = global.config.userRoles[m.sender.number] || {};
        if (!roles.vip) {
            return sock.sendMessage(m.chat.id, { text: global.MSG.vip }, { quoted: m.raw });
        }

        await sock.sendMessage(m.chat.id, {
            text: `¡Hola ${m.sender.name}! 👋 Bienvenido a *${(await m.chat.metaData(), m.chat.name)}*`
        }, { quoted: m.raw });
    }
}
```

Solo con guardar este archivo en `plugins/`, el `Watcher` lo detecta, `ModuleFolder` lo importa y queda disponible de inmediato — sin reiniciar el bot.

---

## 14. Notas técnicas y observaciones

- **Reinicio automático:** si el proceso hijo termina por cualquier motivo (`exit`), `CoreI` lo reinicia automáticamente tras 2 segundos, sin importar la causa.
- **Auto-rechazo de llamadas:** cualquier llamada entrante (voz/video) es rechazada automáticamente por `core/main.js` (`sock.rejectCall`).
- **`core/format.js`** no se importa en ningún otro archivo del proyecto: funciona como una **plantilla/documentación** de la forma del objeto de mensaje, no como código ejecutado.
- **`m.content.handler.js`** llama a `downloadMediaMessage(...)` sin importarla explícitamente en ese archivo — si se usa la descarga de medios, hay que asegurarse de importar esa función desde `@whiskeysockets/baileys` en ese handler.
- **Carpeta `plugins/`:** es referenciada por `index.js` y por `func.plugins.handler.js`, pero no existe en este snapshot del proyecto — debe crearse manualmente antes de añadir comandos.
- **`index.js`** conserva, comentado al final, una versión previa/alternativa del arranque (sin `CoreI`, usando `ForkManager` directamente) — es código legado que puede eliminarse con seguridad.
- **Getters de `chat`/`sender`/`bot` sobre grupos** (`admins`, `size`, `owner`, etc.) dependen de que `m.chat.metaData()` se haya invocado antes (se cachea en `m.__groupMetaData`); si no se llama, devuelven `undefined`.
# Aethero
