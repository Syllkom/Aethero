# Aethero Framework

**Framework Event-Driven modular para bots de WhatsApp sobre Baileys, con aislamiento de procesos (Fork IPC), Hot-Reload nativo y un pipeline de handlers encadenados por prioridad.**

| | |
|---|---|
| **Nombre** | Aethero |
| **Versión** | 1.0.0 |
| **Autor** | Syllkom |
| **Licencia** | MIT |
| **Módulos** | ESM (`"type": "module"`) |
| **Node.js** | `>= 18.0.0` |
| **Motor WhatsApp** | `@whiskeysockets/baileys` |
| **Base de datos** | `@syllkom/hyper-db` (LMDB nativo) |

---

## Tabla de Contenidos

1. [Presentación y Filosofía](#1-presentación-y-filosofía)
2. [Arquitectura del Sistema y Árbol de Directorios](#2-arquitectura-del-sistema-y-árbol-de-directorios)
3. [Configuración Global (`config.js`)](#3-configuración-global-configjs)
4. [Autenticación y Base de Datos](#4-autenticación-y-base-de-datos)
5. [Guía Completa del Objeto de Mensaje `m`](#5-guía-completa-del-objeto-de-mensaje-m)
6. [Guía Exhaustiva de Builders y Socket Extensions](#6-guía-exhaustiva-de-builders-y-socket-extensions)
7. [Sistema de Flujos Conversacionales (`sock.setReplyHandler`)](#7-sistema-de-flujos-conversacionales-socksetreplyhandler)
8. [Desarrollo de Plugins y Scrapers](#8-desarrollo-de-plugins-y-scrapers)
9. [Apéndice: Referencia Rápida de Ficheros](#9-apéndice-referencia-rápida-de-ficheros)

---

## 1. Presentación y Filosofía

**Aethero** es un framework para construir bots de WhatsApp sobre Baileys, diseñado alrededor de tres pilares arquitectónicos que lo diferencian de un bot "monolítico" tradicional: **aislamiento de procesos**, **Hot-Reload total** y un **pipeline de mensajes declarativo por prioridad**.

### 1.1. Aislamiento de Procesos (Fork IPC)

El núcleo de Aethero (`core/`) nunca ejecuta la lógica de conexión de WhatsApp en el mismo proceso que arranca la aplicación. `index.js` instancia la clase `CoreI`, que a su vez crea un `ForkManager` (`core/library/makeFork.js`) — un wrapper sobre el módulo nativo `child_process.fork` de Node.js.

```js
// core/index.js (extracto real)
this.fork = new ForkManager(this.modulePath, {
    execArgv: ['--max-old-space-size=512'],
    cwd: path.resolve(process.cwd()),
    serialization: 'json',
    ...(this.options || {}),
    env: { ...env }
})
```

**¿Por qué esto importa?**

- **Límite de memoria real (512MB):** el flag `--max-old-space-size=512` se pasa como `execArgv` al proceso hijo, capando el heap de V8 de todo el motor del bot (conexión Baileys, handlers, plugins, DB) a 512MB. Si el proceso hijo se desborda o crashea, el proceso padre (el que ejecutó `node index.js`) **nunca muere**.
- **Recuperación ante fallos catastróficos:** en `core/main.js`, cuando el pipeline de handlers detecta un error de código `774` o `428` (Baileys `DisconnectReason.connectionClosed`), el framework **lanza una excepción intencional** (`throw new Error('Tumba la casa mami')`) que termina el proceso hijo. El proceso padre escucha el evento `exit` del fork y lo reinicia automáticamente:

```js
// core/index.js
this.fork.event.set('exit', async ({ code, signal }) => {
    console.log({ code, signal })
    await new Promise(resolve => setTimeout(resolve, 2000))
    await this.fork.start()
})
```

  Esto significa que Aethero trata la reconexión en dos capas: (1) Baileys/`waClient.js` reintenta la reconexión del socket WebSocket ante cortes de red normales, y (2) si el estado interno del proceso queda corrupto, todo el proceso hijo se recicla desde cero en 2 segundos, sin afectar al proceso supervisor.
- **Comunicación:** el padre y el hijo se comunican vía IPC serializado en JSON (`serialization: 'json'`), con soporte para mensajes "fire-and-forget" (`fork.send()`) y peticiones con `Promise` y timeout de 10s (`fork.send(content, 'request')`).

### 1.2. Hot-Reload Nativo (sin librerías intermedias de "watch")

Todo el árbol de módulos dinámicos de Aethero (`plugins/`, `handlers/`, `library/scrapers/`, `library/*.extensions.js`, `library/builders/*.builder.js`) se registra en un único `ModuleRegistry` (`core/library/modules.js`), que internamente usa un `Watcher` (`core/library/watcher.js`) basado en `chokidar`.

Cuando se añade, modifica o elimina un archivo `.js` dentro de cualquiera de esas carpetas registradas, el `Watcher` dispara automáticamente `ImportFile()` o `removeFile()` sobre el módulo afectado — usando **dynamic `import()` con cache-busting por timestamp** (`?update=${Date.now()}`), de modo que Node.js nunca sirve una versión en caché del módulo:

```js
// core/library/modules.js (extracto real)
const FileImport = async function (filePath) {
    const fileURL = (pathToFileURL(filePath)).href
    const versionedURL = `${fileURL}?update=${Date.now()}`
    return await import(versionedURL)
}
```

No hay ninguna dependencia de terceros tipo `nodemon` o `pm2` involucrada en este proceso: el propio núcleo re-importa el archivo modificado y actualiza el `Map` interno de módulos en caliente, sin reiniciar el proceso ni la conexión de WhatsApp.

### 1.3. Pipeline de Mensajes Declarativo por Prioridad

Cada mensaje entrante de WhatsApp pasa a través de una cadena de **handlers** (`handlers/*.handler.js`), ordenados ascendentemente por su propiedad `priority`. Cada handler enriquece progresivamente el objeto de contexto del mensaje (`m`) — inyectando propiedades como `m.chat`, `m.sender`, `m.bot`, `m.content`, o registrando métodos como `m.reply()`. Cualquier handler puede detener la cadena estableciendo `control.end = true`.

Esto convierte a `m` en un objeto que "crece" en capas conforme desciende por el pipeline, y es la base de todo el resto del framework.


---

## 2. Arquitectura del Sistema y Árbol de Directorios

### 2.1. Árbol de directorios completo

```
Aethero/
├── core/                          # NÚCLEO AISLADO — INTOCABLE
│   ├── index.js                   # CoreI: crea y supervisa el Fork (proceso hijo)
│   ├── format.js                  # Forma canónica del objeto "message" (referencia de tipos)
│   ├── main.js                    # Entry-point del proceso HIJO: boot de DB, módulos y socket
│   └── library/
│       ├── bootPrompt.js          # Consola Neofetch + prompt interactivo de vinculación (QR/Pin)
│       ├── hyperDBAdapter.js      # Adaptador LMDB (@syllkom/hyper-db) → global.db
│       ├── hyperDBAuth.js         # Auth-state de Baileys en un único session.json
│       ├── makeFork.js            # ForkManager: wrapper sobre child_process.fork + IPC
│       ├── message.js             # Desenredador de mensajes (resolveMessage / WRAPPER_TYPES)
│       ├── modules.js             # ModuleRegistry / ModuleFolder: registro + Hot-Reload
│       ├── pathStore.js           # Estructura de árbol de rutas (usada por el Watcher)
│       ├── question.js            # Prompt de consola en bucle (PromptLoop)
│       ├── waClient.js            # MakeClient: conexión Baileys + reconexión automática
│       └── watcher.js             # Watcher: chokidar + StoreColl (indexado de archivos)
│
├── handlers/                      # Pipeline de procesamiento de mensajes (orden por priority)
│   ├── m.content.handler.js       # priority: 0.02
│   ├── m.chat.handler.js          # priority: 0.05
│   ├── m.bot.handler.js           # priority: 0.10
│   ├── m.sender.handler.js        # priority: 0.12
│   ├── m.assign.handler.js        # priority: 0.15
│   ├── quoted.chat.handler.js     # priority: 1.1
│   ├── quoted.sender.handler.js   # priority: 1.2
│   ├── m.pre.parser.handler.js    # priority: 1.5
│   ├── func.before.handler.js     # priority: 1.8
│   ├── func.stubtype.handler.js   # priority: 1.9
│   ├── func.log.handler.js        # priority: 2.21
│   └── func.plugins.handler.js    # priority: Infinity
│
├── library/                       # Utilidades de aplicación (fuera de core/)
│   ├── builders/
│   │   ├── commerceBuilder.js       # catalog, order, payment, invoice
│   │   ├── fakeContextBuilder.js    # fakeOrder, fakeCatalog, fakePayment, fakeInvoice, fakeLink
│   │   └── interactiveBuilder.js    # orderStatusMenu, mediaMenu, productMenu, locationMenu, cards, adMenu, album, pollSnapshot, mapButtons
│   ├── media/
│   │   ├── giftConverter.js         # GIF → MP4 (fluent-ffmpeg)
│   │   └── mediaConverter.js        # imagen/video → sticker WebP con EXIF
│   ├── scrapers/
│   │   └── tools/
│   │       └── danbooru.scraper.js  # Scraper de ejemplo, registrado nativamente
│   ├── garbageCollector.js        # Limpieza periódica de ./storage/temp (cada 60s)
│   ├── pluginInspector.js         # Introspección de metadatos de plugins (menús de ayuda)
│   └── socketExtensions.js        # Todas las extensiones inyectadas sobre `sock`
│
├── plugins/                       # Comandos y middlewares del bot
│   └── owner/
│       └── shell.plugin.js        # Ejemplo: eval/shell restringido a root/owner
│
├── config.js                      # Configuración global (global.config, global.db, global.MSG…)
├── index.js                       # Entry-point del proceso PADRE: define el MODULEREGISTRY
└── package.json
```

### 2.2. Diagrama de arquitectura (flujo de arranque y mensajes)

```
┌─────────────────────────────── PROCESO PADRE ────────────────────────────────┐
│                                                                                │
│   index.js                                                                    │
│      │  await import('./config.js')   → puebla global.config / global.db     │
│      │  new CoreI(null, { STORAGE, CONFIG, MODULEREGISTRY })                  │
│      ▼                                                                        │
│   core/index.js  (CoreI)                                                      │
│      │  runBootPrompt()  → Neofetch + selección QR / Pin (si no hay sesión)   │
│      │  new ForkManager(core/main.js, { execArgv:[--max-old-space-size=512] })│
│      ▼                                                                        │
│   fork.start()  ─────────────── fork(child_process) ─────────────────────┐    │
│                                                                            │    │
│   on('exit')  → espera 2s → fork.start()  (auto-reinicio)                 │    │
│   on('message') → EventMessage(m)  (logs de conexión / QR / pairing)      │    │
└────────────────────────────────────────────────────────────────────────┼────┘
                                                                            │
┌─────────────────────────────── PROCESO HIJO ─────────────────────────────▼───┐
│                                                                                │
│   core/main.js                                                                │
│      │  ModuleRegistry(env.MODULEREGISTRY).start()  → Watcher (chokidar)      │
│      │  db.start()                                   → Hyper-DB (LMDB)        │
│      │  MakeClient().start()                          → Baileys makeWASocket  │
│      │  socketExtensions(sock)                        → inyecta sock.reply*   │
│      ▼                                                                        │
│   sock.ev.on('messages.upsert')                                               │
│      │                                                                        │
│      ▼                                                                        │
│   Construcción de "m" (resolveMessage + quoted)                               │
│      │                                                                        │
│      ▼                                                                        │
│   PIPELINE DE HANDLERS (ordenado por priority ascendente)                     │
│      0.02 content → 0.05 chat → 0.10 bot → 0.12 sender → 0.15 assign          │
│      → 1.1 quoted.chat → 1.2 quoted.sender → 1.5 pre.parser (flujos)          │
│      → 1.8 before (middlewares) → 1.9 stubtype (eventos grupo)                │
│      → 2.21 log (consola) → ∞ plugins (enrutador de comandos)                 │
│                                                                                │
│   (cualquier handler puede detener la cadena con control.end = true)          │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.3. Explicación capa por capa

#### `core/` — Núcleo aislado

Esta carpeta contiene el **motor puro** del framework y, según el diseño de Aethero, no debe modificarse en el desarrollo diario de un bot. Se encarga de:

- Gestionar el ciclo de vida del proceso hijo (arranque, supervisión, reinicio) vía `ForkManager`.
- Autenticación en un único archivo (`hyperDBAuth.js` → `storage/creds/main/session.json`).
- Adaptar la base de datos LMDB (`hyperDBAdapter.js` → `@syllkom/hyper-db`).
- Desenredar la estructura de mensajes crudos de Baileys (`message.js`), resolviendo wrappers como `viewOnceMessage` o `ephemeralMessage` hasta llegar al contenido real.
- Renderizar la consola de arranque estilo Neofetch y el flujo de vinculación QR/Pin (`bootPrompt.js`).
- Orquestar la conexión Baileys y su reconexión automática (`waClient.js`).

#### `handlers/` — Pipeline de procesamiento

Cada archivo exporta un objeto `{ enabled, priority, script }`. `script` es una función que se invoca con `.call(m, { sock, control, modules })` desde `core/main.js`, de modo que dentro del handler `this === m`. La sección 5 detalla cada handler exhaustivamente.

#### `library/` — Utilidades de aplicación

Vive en la raíz del proyecto (`./library/`), **fuera** de `core/`, y es el lugar donde normalmente se extiende el framework: builders de mensajes interactivos, conversión de medios, extensiones sobre el objeto `sock` de Baileys, e introspección de plugins para menús de ayuda.

#### `plugins/` — Comandos del bot

Cada archivo `.plugin.js` exporta metadatos (`command`, `usePrefix`, `case`, `category`, `description`, `usage`) y una función `script(m, { sock, plugin, plugins, scraper, scrapers, modules })`. Se cargan y consultan a través del mismo `ModuleRegistry` que los handlers.

#### `library/scrapers/` — Scrapers con Hot-Reload nativo

Registrados en el `MODULEREGISTRY` de `index.js` con el sufijo `.scraper.js`, bajo la carpeta `./library/scrapers`. No requieren ninguna librería intermedia: el mismo `Watcher`/`ModuleRegistry` que gestiona plugins y handlers se encarga de recargarlos en caliente en cuanto detecta un cambio en disco.


---

## 3. Configuración Global (`config.js`)

`config.js` se ejecuta una única vez al arrancar el proceso hijo (`core/main.js` lo importa dinámicamente vía `env.CONFIG`) y puebla el objeto `global` con todo lo que el resto del framework espera encontrar. **Es el primer archivo que debes tocar al iniciar un proyecto sobre Aethero.**

```js
// ./config.js
process.env.HOME = process.cwd()

import path from 'path'
import chalk from 'chalk'
import dotenv from 'dotenv'
dotenv.config()

import base from './core/library/hyperDBAdapter.js'
global.db = base

global.googleApiKey = process.env.GOOGLE_API_KEY || ''

global.readMore = String.fromCharCode(8206).repeat(850)
```

### 3.1. Tabla de variables globales

| Variable | Tipo | Descripción |
|---|---|---|
| `global.db` | `HyperDB` | Instancia de la base de datos LMDB, expuesta por `hyperDBAdapter.js`. Se usa en todo el framework vía `global.db.open(shard)`. |
| `global.googleApiKey` | `string` | Atajo de conveniencia leído de `process.env.GOOGLE_API_KEY`. |
| `global.readMore` | `string` | Cadena invisible (carácter Unicode `8206` repetido 850 veces) útil para forzar el botón "leer más" de WhatsApp en mensajes largos. |
| `global.font` | `object` | Diccionario de URLs de fuentes tipográficas (`NunitoSans`, `NotoSans`, `Anton`, `MonoSpace`, `Montserrat`, `Raleway`) para generación de imágenes/canvas. |
| `global.config` | `object` | Configuración central del bot — ver tabla 3.2. |
| `global.config.userRoles` | `object` | Mapa `{ "<número o jid>": { root, owner, mod, vip } }` — roles estáticos asignados por configuración, fusionados con la base de datos en `m.sender.handler.js`. |
| `global.REACT_EMOJIS` | `object` | Diccionario de alias → emoji, consumido por `m.react(clave)`. Por defecto: `wait`, `done`, `error`. |
| `global.MSG` | `object` | Mensajes de sistema por rol/restricción, consumidos por `m.sms(tipo)`. |
| `global.PLUGINS_MSG` | `object` | Textos coloreados (chalk) para consola al detectar plugin nuevo/actualizado/eliminado. |
| `global.SCRAPERS_MSG` | `object` | Igual que arriba pero para scrapers. |
| `global.$dir_main` | `object` | Rutas absolutas resueltas: `plugins`, `handlers`, `creds`, `store`, `temp`. |

### 3.2. `global.config`

```js
global.config = {
    name: "Aethero",
    prefixes: ".¿?¡!#%&/,~@",       // cualquiera de estos caracteres es un prefijo válido
    saveHistory: true,               // habilita sock.loadMessage() y reconstrucción de dumps
    autoRead: false,                 // auto-lectura global de mensajes
    silentConsole: true,             // si es true, func.log.handler.js NO imprime logs en consola
    startupNotification: false,      // si es true, envía un fakeOrder + adMenu al primer root al conectar
    alwaysOnline: true,              // si es true, el bot siempre se muestra "En línea"
    antiCall: false,                 // si es true, auto-rechaza llamadas entrantes no autorizadas
    antiCallWhitelist: []            // lista de números/JIDs que pueden llamar sin ser rechazados
}

global.config.userRoles = {
    "79282794949": {                // clave: número de teléfono O jid completo
        root: true,
        owner: true,
        mod: true,
        vip: true
    }
}
```

> **Nota de arquitectura:** `global.config.userRoles` no reemplaza la base de datos de roles — se **fusiona** sobre ella en cada mensaje (`m.sender.handler.js`, sección 5.4). Esto permite tener "roles de configuración" inmutables (definidos en código) que siempre prevalecen sobre lo que un administrador pudiera cambiar en la base de datos en tiempo de ejecución.

### 3.3. `global.REACT_EMOJIS` y `global.MSG`

```js
global.REACT_EMOJIS = {
    wait: "⌛",
    done: "✔️",
    error: "✖️"
}

global.MSG = {
    root: 'Este comando solo puede ser utilizado por el *dueño*',
    owner: 'Este comando solo puede ser utilizado por un *propietario*',
    mod: 'Este comando solo puede ser utilizado por un *moderador*',
    vip: 'Esta solicitud es solo para usuarios *premium*',
    group: 'Este comando solo se puede usar en *grupos*',
    private: 'Este comando solo se puede usar por *chat privado*',
    admin: 'Este comando solo puede ser usado por los *administradores del grupo*',
    botAdmin: 'El bot necesita *ser administrador* para usar este comando',
    unreg: 'Regístrese para usar esta función escribiendo:\n\n.registrar nombre.edad',
    restrict: 'Esta función está desactivada'
}
```

Estos dos diccionarios se consumen directamente desde el objeto `m`:

```js
await m.react('wait')     // → reacciona con "⌛"
await m.react('🔥')       // → si la clave no existe en REACT_EMOJIS, usa el texto tal cual
await m.sms('owner')      // → responde con global.MSG.owner
```

### 3.4. `global.$dir_main`

```js
global.$dir_main = {
    plugins: path.resolve('./plugins'),
    handlers: path.resolve('./handlers'),
    creds: path.resolve('./storage/creds'),
    store: path.resolve('./storage/store'),
    temp: path.resolve('./storage/temp'),
}
```

Rutas absolutas precalculadas, útiles cuando un plugin necesita referenciar disco sin recalcular `path.resolve` en cada archivo.

> **Bandera opcional no incluida por defecto — `global.config.iconAI`:** `library/socketExtensions.js` comprueba `global.config.iconAI` antes de inyectar el nodo XML `{ tag: 'bot', attrs: { biz_bot: '1' } }` en mensajes salientes a chats privados (tanto en `sock.sendMessage` como en `sock.relayMessage`). Esto marca el mensaje con el ícono oficial de "bot" de WhatsApp. Por defecto esta clave no existe en `config.js`, por lo que la funcionalidad está desactivada hasta que la definas explícitamente:
>
> ```js
> global.config.iconAI = true
> ```


---

## 4. Autenticación y Base de Datos

### 4.1. Autenticación: sesión única (`hyperDBAuth.js`)

A diferencia del comportamiento por defecto de Baileys (`useMultiFileAuthState`, que escribe **decenas o cientos** de archivos `.json` por cada llave de sesión), Aethero implementa `useHyperDBAuthState()` en `core/library/hyperDBAuth.js`, que persiste **todas** las credenciales y llaves en un **único archivo JSON**:

```
storage/creds/main/session.json         # sesión "main" (por defecto)
storage/subs/<sessionName>/creds/session.json   # sesiones alternas (multi-sesión)
```

**Características clave del implementación:**

- **Escritura atómica:** cada guardado escribe primero a `session.json.tmp` y luego renombra (`fs.promises.rename`) al archivo final, evitando corrupción si el proceso se interrumpe a mitad de escritura.
- **Cola de escritura (debounce natural):** si llega una nueva escritura mientras otra está en curso (`isWriting`), se marca `writeQueued = true` y se reintenta automáticamente al terminar la escritura activa — nunca se pierden actualizaciones de llaves ni se ejecutan escrituras en paralelo sobre el mismo archivo.
- **Serialización compatible con Baileys:** usa `BufferJSON.replacer` / `BufferJSON.reviver` de `@whiskeysockets/baileys` para serializar correctamente los `Buffer` dentro de las credenciales.

```js
// core/library/hyperDBAuth.js (firma pública)
export const useHyperDBAuthState = async (sessionName = 'main') => {
    // ...
    return {
        state: { creds, keys: { get, set } },
        saveCreds: () => { /* escritura atómica en background */ }
    }
}
```

Este objeto se conecta directamente a Baileys en `core/library/waClient.js`:

```js
let { state, saveCreds } = await useHyperDBAuthState(object.sessionName || 'main')
const keyStore = makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" }))

sockConfig.auth = { creds: state.creds, keys: keyStore }
const sock = makeWASocket(sockConfig)
sock.ev.on('creds.update', saveCreds)
```

### 4.2. Reconexión automática (motivo del error 428)

`waClient.js` clasifica cada corte de conexión (`connection === 'close'`) según el `statusCode` de Baileys/Boom:

| Grupo | Razones (`DisconnectReason`) | Acción |
|---|---|---|
| **Reintentable** | `restartRequired`, `connectionLost`, `connectionClosed` (**428**), `unavailableService`, `timedOut` | Emite evento `restart` y vuelve a llamar `StartBot({ ...object, connectType: 'qr-code' })` — reconexión inmediata (con 5s de espera extra si es `unavailableService`). |
| **Sesión terminada** | `loggedOut`, `badSession`, `multideviceMismatch`, `forbidden` | Cierra el socket, **elimina la carpeta de credenciales** (`fs.rm(folderPath, { recursive:true })`) y resuelve `null` — requiere re-vinculación manual (nuevo QR/Pin). |
| **Sesión reemplazada** | `connectionReplaced` | Cierra el socket sin borrar credenciales y resuelve `null` (otra instancia tomó la sesión). |
| **Otro error** | Cualquier otro código | Emite `error`, espera 5s y reintenta. |

Adicionalmente, si el **pipeline de handlers** (no el socket en sí) lanza un error con `statusCode === 774` o `output?.statusCode === 428`, `core/main.js` provoca deliberadamente el *crash* del proceso hijo completo, delegando la recuperación al supervisor del proceso padre (`core/index.js`, ver §1.1) — que reinicia el fork tras 2 segundos. Esta es la doble capa de resiliencia mencionada en la sección de arquitectura.

### 4.3. Base de datos: LMDB nativo vía `@syllkom/hyper-db`

`core/library/hyperDBAdapter.js` inicializa una instancia de `HyperDB` y la expone como `global.db`:

```js
// core/library/hyperDBAdapter.js
const db = new HyperDB({
    folder: dbFolder,        // ./storage/store  (o ./storage/subs/<session>/store)
    memory: 64,
    depth: 2,
    maps: { threshold: 20, debounce: 1000 },
    nodes: { threshold: 10, debounce: 500 }
})
```

El adaptador añade dos métodos de conveniencia:

- **`db.start()`** — imprime un log de arranque y devuelve la instancia.
- **`db.open(shardPath)`** — abre (o crea si no existe) un "shard" (partición) de datos identificado por una clave de cadena, y devuelve el objeto JS mutable directamente. **No hace falta `await db.save()` manual** — el propio motor `HyperDB` persiste los cambios a disco con debounce automático según los umbrales `maps.threshold` / `nodes.threshold`.

```js
const users = await global.db.open('@users')
users['51999999999@lid'] ??= { name: '', banned: false, roles: {} }
users['51999999999@lid'].banned = true   // se persiste automáticamente
```

### 4.4. Convención de shards usados internamente

| Shard | Usado por | Contenido |
|---|---|---|
| `@users` | `m.sender.handler.js`, `m.assign.handler.js` (`m.db`) | Perfil por usuario: `{ name, banned, roles }` |
| `@chat:<jid_de_grupo>` | `m.assign.handler.js` (`m.db`), `m.chat.handler.js` (`chat.db()`) | Datos arbitrarios por grupo |
| `@reply:Handler` | `m.pre.parser.handler.js`, `sock.setReplyHandler` | Flujos conversacionales pendientes (ver sección 7) |
| `@history/<jid>` y `@history/<jid>/<senderId>` | `sock.loadMessage()` | Historial de mensajes (si `global.config.saveHistory` es `true`) |

> **Nota:** el archivo fuente incluido solo documenta el **adaptador** (`hyperDBAdapter.js`). La implementación interna de persistencia LMDB vive dentro del paquete `@syllkom/hyper-db`, que no forma parte de este repositorio y por tanto no se documenta aquí a nivel de internals — únicamente su superficie pública tal como la consume Aethero (`.open()`, acceso directo por propiedad).


---

## 5. Guía Completa del Objeto de Mensaje `m`

Cada mensaje entrante se transforma en un objeto `m` que **crece progresivamente** conforme atraviesa el pipeline de `handlers/`. Esta sección documenta cada capa en el orden exacto en que se ejecuta.

### 5.0. Forma base de `m` (antes de cualquier handler)

Construida directamente en `core/main.js` a partir del mensaje crudo de Baileys (`rawMessage`), usando `resolveMessage()` de `core/library/message.js` para desenredar wrappers (`viewOnceMessage`, `ephemeralMessage`, `editedMessage`, etc.):

```js
const m = {
    key: rawMessage.key,
    message: rawMessage.message,
    get raw() { return rawMessage },
    id: rawMessage.key.id,
    category: message.category,        // 'CONTENT' | 'SYSTEM' | 'UNKNOWN'
    type: message.type,                // p.ej. 'extendedTextMessage', 'imageMessage'…
    get messageData() { return message.messageData },
    contextInfo: message.messageData?.contextInfo,
    messageTimestamp: rawMessage.messageTimestamp,
    broadcast: rawMessage.broadcast,
    pushName: rawMessage.pushName,
}
```

Si el mensaje cita a otro (`contextInfo.quotedMessage`), se construye además `m.quoted` con la misma forma (`key`, `message`, `raw`, `id`, `type`, `messageData`, `contextInfo`, más `quotedType`, `category`).

### 5.1. `m.content` — priority `0.02` (`m.content.handler.js`)

Extrae el texto plano y los metadatos multimedia del mensaje, para **tanto el mensaje principal como el citado** (`m.quoted.content`).

```js
this.content = {
    isMedia: true | undefined,          // true si el tipo es imagen/video/audio/documento
    text: "texto extraído",             // conversation, caption, extendedTextMessage.text, botón pulsado…
    args: ["texto", "extraído"],        // text.split(/ +/)
    media: undefined | {                // solo si isMedia
        mimeType: "image/jpeg",
        fileName: "",
        download: async (type = 'buffer') => Buffer   // usa downloadMediaMessage de Baileys
    }
}
```

Tipos de mensaje reconocidos para extracción de texto: `conversation`, `imageMessage` (caption), `videoMessage` (caption), `extendedTextMessage`, `buttonsResponseMessage` (`selectedButtonId`), `templateButtonReplyMessage` (`selectedId`), `interactiveResponseMessage` (parsea `nativeFlowResponseMessage.paramsJson` y extrae `.id`).

```js
// Ejemplo: plugin que descarga la imagen que se acaba de enviar
export default {
    command: true, case: ['sticker', 's'],
    script: async (m, { sock }) => {
        if (!m.content.isMedia && !m.quoted?.content?.isMedia) {
            return m.reply('Envía o cita una imagen/video.')
        }
        const buffer = m.content.isMedia
            ? await m.content.media.download()
            : await m.quoted.content.media.download()
        // ... procesar buffer
    }
}
```

### 5.2. `m.chat` — priority `0.05` (`m.chat.handler.js`)

```js
this.chat = {
    id: "5219...@s.whatsapp.net" | "1203...@g.us",
    isGroup: Boolean,
    async metaData() { /* cachea sock.groupMetadata() en m.__groupMetaData */ },
    // Getters (requieren que metaData() se haya resuelto — automático si isGroup):
    get size() {},
    get desc() {},
    get name() {},
    get created() {},
    get participants() {},
    get owner() {},
    get admins() {},        // array de JIDs con rol admin/superadmin
}
```

Si `isGroup === true`, el handler **ya invoca `await this.chat.metaData()`** antes de devolver el control, por lo que en cualquier plugin posterior `m.chat.name`, `m.chat.admins`, etc. están disponibles de inmediato sin `await` adicional. Además se añaden las **acciones de grupo**:

```js
m.chat.add(user)                        // sock.groupParticipantsUpdate(id, [user], 'add')
m.chat.remove(user)                     // ... 'remove'
m.chat.promote(user)                    // ... 'promote'
m.chat.demote(user)                     // ... 'demote'
m.chat.getPhoto(type = 'image', id)     // sock.profilePictureUrl
m.chat.setPhoto(image)                  // sock.updateProfilePicture
m.chat.setDesc(desc)                    // sock.groupUpdateDescription
m.chat.setName(name)                    // sock.groupUpdateSubject
m.chat.getCodeInvite()                  // sock.groupInviteCode(id)
m.chat.getLinkInvite()                  // `https://chat.whatsapp.com/${code}`
m.chat.revoke()                         // sock.groupRevokeInvite(id)
m.chat.settings.lock(bool)              // groupSettingUpdate('locked' | 'unlocked')
m.chat.settings.announce(bool)          // groupSettingUpdate('announcement' | 'not_announcement')
m.chat.settings.memberAdd(bool)         // groupSettingUpdate('all_member_add' | 'admin_add')
m.chat.settings.joinApproval(bool)      // groupJoinApprovalMode('on' | 'off')
m.chat.db()                             // global.db.open('@chat:' + id)
```

En **chats privados**, en vez de las acciones anteriores se exponen:

```js
m.chat.getDesc()    // sock.fetchStatus(id).status
m.chat.getPhoto()   // sock.profilePictureUrl(id, 'image')
m.chat.db()         // registro del interlocutor dentro del shard '@users'
```

```js
// Ejemplo: comando de grupo ".promover @usuario"
export default {
    command: true, case: 'promover',
    script: async (m) => {
        if (!m.chat.isGroup) return m.sms('group')
        if (!m.sender.isAdmin) return m.sms('admin')
        if (!m.bot.isAdmin) return m.sms('botAdmin')

        const target = m.sender.mentioned[0]
        if (!target) return m.reply('Menciona a un usuario.')

        await m.chat.promote(target)
        await m.reply(`✅ @${target.split('@')[0]} ahora es administrador.`)
    }
}
```


### 5.3. `m.bot` — priority `0.10` (`m.bot.handler.js`)

Representa al propio bot como si fuera un actor del chat.

```js
this.bot = {
    get isAdmin() {},          // true si el bot está en m.chat.admins
    id: "5219...@lid",
    user: "@5219...",          // string listo para menciones
    number: "5219...",
    name: "Nombre del bot",
    fromMe: Boolean,           // this.raw.key.fromMe
    roles: { root: true, owner: true, mod: true, vip: true, admin: isBotAdmin }
}
```

> El bot **siempre** tiene `root`, `owner`, `mod` y `vip` en `true` de forma hardcodeada — únicamente `admin` depende del estado real del grupo.

Acciones del bot:

```js
m.bot.getDesc()                 // sock.fetchStatus(bot.id).status
m.bot.getPhoto()                // sock.profilePictureUrl(bot.id, 'image')
m.bot.setPhoto(image)           // sock.updateProfilePicture(bot.id, image)
m.bot.setDesc(desc)             // sock.updateProfileStatus(desc)
m.bot.setName(name)             // sock.updateProfileName(name)
m.bot.join(link)                // sock.groupAcceptInvite(link)
m.bot.mute(id, bool, time)      // sock.chatModify({ mute: time|null }, id, [])  — time por defecto 8h
m.bot.block(id, bool)           // sock.updateBlockStatus(id, 'block' | 'unblock')
m.bot.role('root', 'owner')     // true si CUALQUIERA de los roles indicados es true
```

```js
// Ejemplo: cambiar la foto de perfil del bot citando una imagen
export default {
    command: true, case: 'setpp', usePrefix: true,
    script: async (m) => {
        if (!m.sender.role('root', 'owner')) return m.sms('owner')
        if (!m.quoted?.content?.isMedia) return m.reply('Cita una imagen.')

        const buffer = await m.quoted.content.media.download()
        await m.bot.setPhoto(buffer)
        await m.react('done')
    }
}
```

### 5.4. `m.sender` — priority `0.12` (`m.sender.handler.js`)

```js
this.sender = {
    id: "5219...@lid",
    number: "5219...",
    mentioned: ["5219...@lid", ...],   // contextInfo.mentionedJid
    name: "Nombre en WhatsApp",
    user: "@5219...",
    roles: { root: false, owner: false, mod: false, vip: false, bot: false },
    get isAdmin() {},                  // requiere metadata de grupo cacheada
    getDesc: async () => {},
    getPhoto: async () => {},
    db: async () => {},                // registro en el shard '@users', creándolo si no existe
    role: (...roles) => Boolean        // true si CUALQUIERA de los roles indicados es true
}
```

**Sincronización de roles (importante):** en cada mensaje, este handler:

1. Abre (o crea) el registro del remitente en el shard `@users`.
2. **Fusiona** `global.config.userRoles[sender.id]` o `global.config.userRoles[sender.number]` sobre los roles guardados en base de datos (los roles de configuración prevalecen).
3. Si el mensaje proviene del propio bot (`fromMe`) o el remitente **es** el bot, fuerza `{ root: true, owner: true, mod: true, vip: true, bot: true }`.

```js
// Ejemplo: comando restringido combinando roles de config + DB
export default {
    command: true, case: 'baneuser',
    script: async (m) => {
        if (!m.sender.role('root', 'owner', 'mod')) return m.sms('mod')
        const target = m.sender.mentioned[0] || m.quoted?.sender?.id
        if (!target) return m.reply('Menciona o cita a un usuario.')

        await m.setBan(target, true)
        await m.reply('🔨 Usuario baneado.')
    }
}
```

### 5.5. `m.assign` — priority `0.15` (`m.assign.handler.js`)

Este handler no añade una nueva "sub-propiedad" — inyecta **métodos directamente sobre `m`**, disponibles a partir de aquí para el resto del pipeline (incluidos todos los plugins).

#### `m.reply(texto, opciones = {})`

```js
await m.reply('Hola mundo')
await m.reply({ text: 'Hola', mentions: [...] })          // objeto: se pasa tal cual a sock.sendMessage
await m.reply('Hola @51999999999', { }) // detecta @número y agrega mentions automáticamente
```

- Simula estado de escritura real: calcula `typingDelay = min(texto.length * 30, 3000) + random(0-500)ms`, envía `sendPresenceUpdate('composing', chat.id)`, espera el delay, y luego `sendPresenceUpdate('paused', chat.id)`.
- Por defecto **cita el mensaje original** (`{ quoted: m.raw }`), salvo que `opciones.quoted` lo sobreescriba.
- Si `texto` es un `string`, detecta automáticamente patrones `@(\d{0,16})` dentro del texto y los añade como `contextInfo.mentionedJid` (formato `<número>@lid`) — no hace falta pasar `mentions` manualmente para menciones simples.
- Si `texto` es un `object`, se pasa directamente como segundo argumento de `sock.sendMessage` (útil para builders: `m.reply({ productMenu: {...} })`).

#### `m.react(textoOClave)`

```js
await m.react('wait')     // resuelve alias vía global.REACT_EMOJIS
await m.react('done')
await m.react('error')
await m.react('🎉')       // emoji literal si no existe como alias
```

#### `m.sms(tipo)`

```js
await m.sms('owner')      // responde con global.MSG.owner vía m.reply()
```

#### `m.db(id)`

```js
const chatData = await m.db('1203...@g.us')     // → global.db.open('@chat:' + id)
const userData = await m.db('5219...@lid')      // → registro en '@users', autocreado si no existe
```

#### `m.setBan(id, estado = true)` / `m.setRole(id, estado, ...roles)`

```js
await m.setBan('5219...@lid', true)
await m.setRole('5219...@lid', true, 'vip')
await m.setRole('5219...@lid', false, 'mod', 'vip')   // revoca ambos roles a la vez
```

#### `m.getQuotedText()` / `m.getQuotedMedia()`

```js
const texto = m.getQuotedText()          // busca en m.quoted.content.text, .body o el mensaje crudo citado
const buffer = await m.getQuotedMedia()  // descarga el media citado, o null si no hay/falla
```

### 5.6. `m.quoted.chat` — priority `1.1` (`quoted.chat.handler.js`)

Espejo **de solo lectura** de `m.chat`, pero aplicado al contexto del mensaje **citado** (no expone acciones como `add`/`remove`/`setPhoto`, solo los getters informativos):

```js
this.quoted.chat = {
    id, isGroup,
    async metaData() {},
    get size() {}, get desc() {}, get name() {},
    get created() {}, get participants() {}, get owner() {}, get admins() {}
}
```

> **Nota técnica:** `metaData()` de `m.quoted.chat` invoca internamente `m.sock.groupMetadata(this.id)`. Dado que el objeto `sock` se inyecta **por argumento** a cada handler (no como propiedad de `m`), `m.sock` no está definido en ningún otro punto del framework — si tu grupo cita un mensaje de otro grupo y necesitas sus metadatos, considera resolverlos manualmente con el `sock` que sí recibes en el contexto de tu handler/plugin en lugar de depender de este getter.

### 5.7. `m.quoted.sender` — priority `1.2` (`quoted.sender.handler.js`)

```js
this.quoted.sender = {
    id: "5219...@lid",             // quoted.key.participant
    number: "5219...",
    user: "@5219...",
    get isAdmin() {}
}
```

Más ligero que `m.sender`: no expone `db()`, `getDesc()`, `getPhoto()` ni `roles` — solo identidad básica de quien envió el mensaje citado.

```js
// Ejemplo combinando m.quoted.sender con m.setRole
export default {
    command: true, case: 'vip',
    script: async (m) => {
        if (!m.sender.role('root', 'owner')) return m.sms('owner')
        const target = m.quoted?.sender?.id || m.sender.mentioned[0]
        if (!target) return m.reply('Cita o menciona a un usuario.')

        await m.setRole(target, true, 'vip')
        await m.reply('⭐ Usuario ascendido a VIP.')
    }
}
```


### 5.8. Propiedades de parseo de comandos — priority `Infinity` (`func.plugins.handler.js`)

Justo antes de enrutar hacia un plugin de comando, este handler (el último de la cadena) calcula:

```js
this.body   // texto completo del mensaje (alias de m.content.text)
this.tag    // array de valores extraídos de patrones "tag=xxx" dentro del body (y los remueve del body)
this.args   // palabras del body después de la primera (el "comando")
this.text   // args.join(' '), o el body completo si no hay args
this.command // primera palabra del body, en minúsculas (con o sin el carácter de prefijo, según config)
this.isCmd  // true si `command` coincide con algún plugin registrado
this.plugin // referencia al objeto del plugin encontrado, o null
```

La detección de prefijo respeta `global.config.prefixes` (cadena de caracteres, cada uno válido como prefijo individual):

```js
// Con prefixes = ".¿?¡!#%&/,~@" y mensaje ".ping hola mundo"
m.body     // ".ping hola mundo"
m.command  // "ping"
m.args     // ["hola", "mundo"]
m.text     // "hola mundo"

// Con prefixes = ".¿?¡!#%&/,~@" y mensaje "ping hola" (sin prefijo)
// → solo coincide con plugins que declaren usePrefix: false
```

**Etiquetas (`tag=`):** cualquier token `tag=<valor>` en el cuerpo del mensaje se extrae a `m.tag` (array) y se elimina del `m.body` antes de calcular `m.args`/`m.text`. Útil para pasar metadatos a un comando sin que interfieran con el parseo normal:

```
.broadcast tag=vip Hola a todos los premium
```
```js
m.tag   // ["vip"]
m.body  // ".broadcast Hola a todos los premium"  (ya limpio de "tag=vip")
```

### 5.9. Tabla resumen del pipeline completo

| Orden | `priority` | Archivo | Qué añade / hace |
|---|---|---|---|
| 1 | `0.02` | `m.content.handler.js` | `m.content`, `m.quoted.content` |
| 2 | `0.05` | `m.chat.handler.js` | `m.chat` (+ acciones de grupo/privado) |
| 3 | `0.10` | `m.bot.handler.js` | `m.bot` (+ acciones del bot) |
| 4 | `0.12` | `m.sender.handler.js` | `m.sender` (+ sincronización de roles) |
| 5 | `0.15` | `m.assign.handler.js` | `m.reply`, `m.react`, `m.sms`, `m.db`, `m.setBan`, `m.setRole`, `m.getQuotedText`, `m.getQuotedMedia` |
| 6 | `1.1` | `quoted.chat.handler.js` | `m.quoted.chat` |
| 7 | `1.2` | `quoted.sender.handler.js` | `m.quoted.sender` |
| 8 | `1.5` | `m.pre.parser.handler.js` | Ejecuta flujos conversacionales registrados con `sock.setReplyHandler` (§7) |
| 9 | `1.8` | `func.before.handler.js` | Ejecuta plugins middleware `before: true` (antilink, antibot, autodl, blocker…) |
| 10 | `1.9` | `func.stubtype.handler.js` | Enruta eventos de grupo (promociones, cambios de foto, etc.) a plugins `stubtype: true` |
| 11 | `2.21` | `func.log.handler.js` | Log de consola (silenciado si `global.config.silentConsole`) |
| 12 | `Infinity` | `func.plugins.handler.js` | Parseo de comando + enrutamiento final a `plugins/*.plugin.js` |

> Cualquier handler puede detener la cadena escribiendo `control.end = true` en su tercer argumento — típicamente lo hace el ejecutor de un flujo conversacional (§7) para evitar que el mensaje también sea interpretado como un comando nuevo.


---

## 6. Guía Exhaustiva de Builders y Socket Extensions

Todas las extensiones descritas en esta sección se inyectan sobre el objeto `sock` de Baileys en `library/socketExtensions.js`, ejecutado una vez en `core/main.js` justo después de que la conexión abre: `await socketExtensions(sock)`. A partir de ahí, `sock.sendMessage(jid, content, options)` reconoce automáticamente un conjunto de claves especiales en `content` y despacha al *builder* correspondiente — **no es necesario llamar a los builders directamente**, basta con usar `sock.sendMessage` normalmente.

### 6.0. Sistema Avanzado de Botones, Íconos Nativos y Layouts Inline (`mapButtons`)

Todos los menús interactivos (`orderStatusMenu`, `mediaMenu`, `productMenu`, `interactiveMenu`, `locationMenu`) procesan su array `buttons` a través de `mapButtons()` (`library/builders/interactive.builder.js`). Este transformador soporta tanto botones convencionales como combinaciones avanzadas de **íconos nativos**, **botones compactos (`iconOnly`)** y **alineación horizontal (`inline`)**.

---

#### A. Tipos de Botones Base (`type`)

| `type` | Botón Nativo (Protocolo) | Parámetros Clave |
|---|---|---|
| `'url'` / `'url_icon'` | `cta_url` | `text`, `url` |
| `'call'` / `'call_icon'` | `cta_call` | `text`, `phone` (o `id`) |
| `'copy'` / `'copy_icon'` | `cta_copy` | `text`, `payload` (código a copiar) |
| `'view_catalog'` / `'catalog_store'` | `automated_greeting_message_view_catalog` | `phone` (o `number`), `productId` (opcional) |
| `'list'` / `'list_icon'` | `single_select` | `text` (título), `sections` (`title`, `rows`) |
| `'reminder'` / `'cancel_reminder'` | `cta_reminder` / `cta_cancel_reminder` | `text`, `id` |
| `'address'` / `'location'` | `address_message` / `send_location` | `text`, `id` |
| `'vcard'` | `vcard_message` | `text`, `vcard` |
| `'galaxy'` / `'flow'` | `galaxy_message` | `flowId`, `text`, `action`, `payload`, `token`, `metadata` |
| `'signup'` / `'contact'` | `inapp_signup` / `request_contact_info` | — |
| `'order_status'` | `order_status` | `referenceId`, `status`, `price`, `currency` |
| *(sin type / `'reply'`)* | `quick_reply` | `text`, `id` |

---

#### B. Íconos Nativos y "Ocultos" (`icon`)

WhatsApp permite asociar íconos nativos a cualquier botón (`quick_reply`, listas o acciones) inyectando la propiedad `icon`.

| Identificador de Ícono (`icon`) | Representación Visual | Descripción |
|---|---|---|
| `'review'` | 👍 *(Like / Pulgar arriba)* | Ideal para calificaciones, feedback o botones de Me Gusta. |
| `'promotion'` | 🏷️ *(Etiqueta de descuento)* | Perfecto para ofertas, códigos promocionales y descuentos. |
| `'default'` | 📄 *(Documento / Hoja)* | Icono estándar de archivo, opciones o lista de texto. |
| `'location'` | 📍 *(Marcador de mapa)* | Para acciones de geolocalización o sucursales. |

Existen dos formas de aplicar estos íconos:
1. **Vía propiedad `icon` directa:**
   ```js
   { type: 'reply', text: 'Me Gusta', id: '.like', icon: 'review' }
   { type: 'reply', text: 'Promoción', id: '.oferta', icon: 'promotion' }
   ```
2. **Vía sufijo `_icon` en el `type`:**
   ```js
   { type: 'list_icon', text: 'Opciones', sections: [...] }
   { type: 'url_icon', text: 'Visitar', url: 'https://...' }
   { type: 'copy_icon', text: 'Copiar', payload: 'CÓDIGO' }
   ```

---

#### C. Modo Solo Ícono (`iconOnly: true`)

Si activas `iconOnly: true` en un botón, el framework sustituye automáticamente el texto visible por un carácter invisible (`\u0000` o `" "`), haciendo que el botón se renderice de forma compacta mostrando únicamente el icono nativo de su acción (como el carrito de catálogo, copiar código o llamada).

```js
// Botón compacto que solo muestra el icono de Catálogo
{ type: 'view_catalog', iconOnly: true, phone: '51999999999' }

// Botón compacto que solo muestra el icono de Copiar
{ type: 'copy', iconOnly: true, payload: 'CÓDIGO123' }
```

---

#### D. Reglas de Distribución Horizontal (`inline`)

WhatsApp cuenta con reglas estrictas de diseño para colocar botones en una sola fila horizontal:

1. **2 Botones en una línea:** Puedes alinear horizontalmente **2 botones de cualquier tipo** (texto normal, URL, reply, etc.) activando `inline: true` en el menú o en los botones.
2. **Hasta 3 Botones en una línea:** WhatsApp **solo** permite agrupar **3 botones en una misma línea** si **todos** ellos tienen `iconOnly: true`. Si alguno contiene texto visible, la interfaz colapsará los botones a disposición vertical.

---

#### E. Ejemplos de Implementación

##### 1. Menú con Flows (Galaxy), Like con ícono y Promoción
```js
await sock.sendMessage(m.chat.id, {
    mediaMenu: {
        image: "https://files.catbox.moe/obz4b4.jpg",
        body: "*🧪 Test de Íconos Nativos*\n\n- Catálogo: type 'view_catalog' 🛍️\n- Me Gusta: icon 'review' 👍\n- Promoción: icon 'promotion' 🏷️",
        footer: "Aethero Engine",
        buttons: [
            { type: 'galaxy', text: 'Abrir Flow / Galaxy', flowId: '1307913409923914' },
            { type: 'reply', text: 'Me Gusta', id: '.like', icon: 'review' },
            { type: 'reply', text: 'Promoción Especial', id: '.oferta', icon: 'promotion' }
        ]
    }
}, { quoted: m.raw })
```

##### 2. Menú con Botón Solo Ícono (`default` tipo hoja) + Promoción
```js
await sock.sendMessage(m.chat.id, {
    mediaMenu: {
        image: "https://files.catbox.moe/obz4b4.jpg",
        body: "Selecciona una de las opciones interactivas:",
        footer: "Aethero Engine",
        buttons: [
            { type: 'galaxy', text: 'Abrir Flow', flowId: '1307913409923914' },
            { type: 'default', iconOnly: true, text: 'Me Gusta', id: '.like', icon: 'default' },
            { type: 'reply', text: 'Promoción Especial', id: '.oferta', icon: 'promotion' }
        ]
    }
}, { quoted: m.raw })
```

##### 3. Menú Completo: URL, Catálogo IconOnly, Copiar IconOnly y Menú Desplegable (List) con Oferta
```js
await sock.sendMessage(m.chat.id, {
    mediaMenu: {
        image: "https://files.catbox.moe/obz4b4.jpg",
        title: "Aethero Store",
        body: "Catálogo interactivo con botones combinados.",
        footer: "Aethero Engine",
        offer: {
            text: "Aethero Latest Version",
            code: "AETHERO2026",
            url: "https://github.com/Syllkom"
        },
        buttons: [
            { type: 'url', text: 'Unirme al Grupo', url: 'https://chat.whatsapp.com/Cpztu5iwvlr7v90C6Y2wPu' },
            { type: 'view_catalog', iconOnly: true, phone: m.sender.number || '51999999999' },
            { type: 'copy', iconOnly: true, text: 'Copiar Código', payload: 'AETHERO2026' },
            { 
                type: 'list', 
                text: 'Ver Opciones', 
                sections: [
                    { 
                        title: 'Principal', 
                        rows: [
                            { title: 'Catálogo Completo', description: 'Explora todos los productos', id: '.catalogo' },
                            { title: 'Soporte', description: 'Contacta con asistencia', id: '.soporte' }
                        ] 
                    }
                ] 
            }
        ]
    }
}, { quoted: m.raw })
```

### 6.1. `orderStatusMenu` — Menú de estado de orden con ofertas e inline

```js
await sock.sendMessage(m.chat.id, {
    orderStatusMenu: {
        title: "Aethero Store",
        subtitle: "Tu pedido está en camino",
        body: "Gracias por tu compra 🛍️",
        footer: "Powered by Aethero",
        image: "https://files.catbox.moe/obz4b4.jpg",   // o Buffer
        inline: true,
        offer: {
            text: "20% OFF hoy",
            url: "https://tutienda.com/oferta",
            code: "AETHERO20",
            expiration: Date.now() + 1000 * 60 * 60 * 24  // 24h
        },
        bottomSheet: {
            title: "Más opciones",
            buttonTitle: "Ver todo"
        },
        buttons: [
            { type: 'order_status', text: 'Ver estado', referenceId: '360', status: 'completed', price: 49.9, currency: 'USD' },
            { type: 'url', text: 'Rastrear pedido', url: 'https://tutienda.com/track/360' },
            { type: 'copy', text: 'Copiar cupón', payload: 'AETHERO20' }
        ]
    }
}, { quoted: m.raw })
```

### 6.2. `mediaMenu` — Menú con imagen/video, bottomSheet y ofertas

```js
await sock.sendMessage(m.chat.id, {
    mediaMenu: {
        title: "Nueva colección",
        subtitle: "Disponible ahora",
        body: "Elige una de las opciones de abajo 👇",
        footer: "Aethero Engine",
        video: "https://files.catbox.moe/ejemplo.mp4",   // o `image:` en su lugar
        bottomSheet: { limit: 2, title: "Catálogo", buttonTitle: "Explorar" },
        offer: { text: "Envío gratis", url: "https://tutienda.com" },
        buttons: [
            { type: 'list', text: 'Ver categorías', sections: [
                { title: 'Ropa', rows: [{ title: 'Camisetas', rowId: 'cat_shirts' }] }
            ]},
            { text: 'Contactar ventas', id: 'contact_sales' }  // quick_reply implícito
        ]
    }
}, { quoted: m.raw })
```

### 6.3. `productMenu` — Tarjeta/menú de producto de tienda

```js
await sock.sendMessage(m.chat.id, {
    productMenu: {
        title: "Camiseta Aethero",
        body: "Edición limitada, 100% algodón",
        footer: "Stock disponible",
        image: "https://files.catbox.moe/camiseta.jpg",
        productId: "SHIRT_001",
        description: "Talla única, envíos a todo el país",
        price: 25.5,
        salePrice: 19.9,           // precio de oferta (opcional)
        currency: "USD",
        retailerId: "Aethero",
        inline: true,
        buttons: [
            { type: 'url', text: 'Comprar ahora', url: 'https://tutienda.com/shirt-001' }
        ]
    }
}, { quoted: m.raw })
```

> **Detalle de implementación:** `productMenu` (al igual que `interactiveMenu`) se envuelve internamente en un `viewOnceMessage` con `messageContextInfo.deviceListMetadataVersion: 2` — esto es exigido por el protocolo de WhatsApp para que las tarjetas de producto/documento con botones nativos se rendericen correctamente en el cliente.

### 6.4. `interactiveMenu` — Menú interactivo con documento adjunto

```js
await sock.sendMessage(m.chat.id, {
    interactiveMenu: {
        title: "Catálogo PDF 2026",
        subtitle: "Descarga nuestro catálogo completo",
        body: "Toca el botón para explorar el documento",
        footer: "Aethero Store",
        document: "https://files.catbox.moe/catalogo.pdf",   // URL o Buffer
        thumbnail: "https://files.catbox.moe/portada.jpg",
        fileName: "Catalogo-2026.pdf",
        mimetype: "application/pdf",
        buttons: [
            { type: 'url', text: 'Ver online', url: 'https://tutienda.com/catalogo' }
        ]
    }
}, { quoted: m.raw })
```

### 6.5. `locationMenu` — Menú interactivo con mapa/ubicación

```js
await sock.sendMessage(m.chat.id, {
    locationMenu: {
        title: "Nuestra tienda física",
        subtitle: "Visítanos",
        body: "Av. Principal 123",
        footer: "Lun-Sáb 9am-8pm",
        mapImage: "https://files.catbox.moe/mapa.jpg",
        locationName: "Aethero Store",
        locationAddress: "Av. Principal 123, Arequipa",
        locationUrl: "https://maps.google.com/?q=-16.4,-71.5",
        thumbnail: "https://files.catbox.moe/mapa-mini.jpg",
        thumbTitle: "Aethero",
        thumbBody: "Toca para ver el mapa",
        buttons: [
            { type: 'location', text: 'Cómo llegar' }
        ]
    }
}, { quoted: m.raw })
```

### 6.6. `cards` — Tarjeta con imagen

```js
await sock.sendMessage(m.chat.id, {
    cards: {
        image: "https://files.catbox.moe/promo.jpg",
        text: "🎉 Promoción especial de la semana",
        footer: "Válido hasta agotar stock",
        buttons: [
            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: 'Quiero más info', id: 'promo_info' }) }
        ]
    }
}, { quoted: m.raw })
```

> A diferencia de los demás menús, `cards.buttons` se pasa **tal cual** al array nativo de botones (sin pasar por `mapButtons`) — espera el formato ya resuelto `{ name, buttonParamsJson }`.

### 6.7. `adMenu` — Anuncio interactivo (registro/`inapp_signup`)

```js
await sock.sendMessage(m.chat.id, {
    adMenu: {
        title: "Anuncio de Aethero",
        body: "▢ Aethero Conectado\n● Sistema en línea con éxito."
    }
}, { quoted: m.raw })
```

`adMenu` es intencionalmente minimalista: siempre genera un único botón nativo `inapp_signup`. Es el mismo builder usado internamente por `core/main.js` para la notificación de arranque (`global.config.startupNotification`).

### 6.8. `album` — Envío agrupado nativo de múltiples imágenes/videos

```js
await sock.sendMessage(m.chat.id, {
    album: [
        { type: 'image', data: { url: 'https://files.catbox.moe/1.jpg' }, caption: 'Primera' },
        { type: 'image', data: { url: 'https://files.catbox.moe/2.jpg' } },
        { type: 'video', data: { url: 'https://files.catbox.moe/3.mp4' } }
    ]
}, { caption: 'Álbum completo 📸', quoted: m.raw })
```

- Con **menos de 2 elementos**, el framework degrada automáticamente a un `sock.sendMessage` normal (imagen o video suelto).
- Con **2 o más**, genera un `albumMessage` nativo (protocolo real de "álbum" de WhatsApp) vía `generateWAMessageFromContent` + `relayMessage`, seguido de un mensaje individual por cada media, enlazado mediante `messageContextInfo.messageAssociation.parentMessageKey` — con una pausa de 500ms entre cada envío para respetar el orden de entrega.
- El `caption` de nivel superior (`options.caption`) se aplica solo al **primer** elemento del álbum.


### 6.9. `pollSnapshot` — Estadísticas de encuesta (bonus)

No solicitado explícitamente en el listado inicial de builders, pero presente y funcional en `interactiveBuilder.js`. Genera un `pollResultSnapshotMessage` (tarjeta de resultados de encuesta, sin ser una encuesta interactiva real):

```js
await sock.sendMessage(m.chat.id, {
    pollSnapshot: {
        title: "Resultados de la encuesta",
        stats: [
            { name: "Opción A", value: 12 },
            { name: "Opción B", value: 7 }
        ]
    }
}, { quoted: m.raw })
```


### 6.10. `locationButtons` / `buttonsMenu` — Botones compactos con cabecera multimedia (Estilo Telegram)

Genera un mensaje basado en el protocolo nativo `buttonsMessage` con cabecera de tipo ubicación (`headerType: 6`), renderizando una tarjeta superior con imagen/mapa translúcido y botones horizontales compactos distribuidos en fila (idénticos a los botones inline de Telegram).

A diferencia de los menús interactivos complejos (`interactiveMessage`), este formato procesa botones directos de acción rápida (`type: 1`) que envían el comando o texto de `buttonId` inmediatamente al presionarlos.

```js
await sock.sendMessage(m.chat.id, {
    locationButtons: {
        title: "Aethero Downloader",
        subtitle: "© Syllkom Engine",
        image: "https://files.catbox.moe/obz4b4.jpg", // URL o Buffer (redimensionado a 300px automáticamente)
        body: "❍⌇─➭ *Youtube-Downloader*\n\nSelecciona el formato de descarga abajo:",
        footer: "© Aethero Framework",
        buttons: [
            { text: "Audio", id: ".ytae https://youtube.com/watch?v=..." },
            { text: "Vídeo", id: ".play2e https://youtube.com/watch?v=..." }
        ]
    }
}, { quoted: m.raw })
```

#### Parámetros reconocidos

| Clave | Tipo | Descripción |
|---|---|---|
| `title` / `name` | `string` | Título en negrita dentro de la barra azul superior. |
| `subtitle` / `address` | `string` | Subtítulo o descripción secundaria en la barra superior. |
| `image` | `string \| Buffer` | Imagen de portada. El builder la procesa automáticamente con `sock.resizePhoto({ scale: 300 })`. |
| `body` / `text` | `string` | Cuerpo de texto del mensaje. |
| `footer` | `string` | Texto del pie de página (gris claro). |
| `buttons` | `array` | Lista de botones `{ text, id }` (o `{ displayText, buttonId }`). |

> **Nota:** Puedes usar indistintamente la clave `locationButtons` o su alias `buttonsMenu` dentro de `sock.sendMessage`.
```


### 6.10.1 Mensajes de Comercio Directos (`commerceBuilder.js`)

Además de los menús interactivos anteriores, `sock.sendMessage` reconoce cuatro claves de "comercio directo" que generan los tipos de mensaje **nativos** de WhatsApp Business (`productMessage`, `orderMessage`, tarjetas de pago e invoice vía `interactiveMessage`):

```js
// Tarjeta de producto de catálogo real
await sock.sendMessage(jid, {
    catalog: {
        id: "PROD_001",
        title: "Camiseta Aethero",
        body: "100% algodón",
        image: "https://files.catbox.moe/camiseta.jpg",
        currency: "USD",
        price: 25.5,
        retailerId: "Aethero",
        url: "https://tutienda.com/shirt"
    }
})

// Tarjeta de orden/pedido
await sock.sendMessage(jid, {
    order: {
        id: "ORD_2026_001",
        title: "Pedido #001",
        text: "Tu pedido fue confirmado",
        image: "https://files.catbox.moe/orden.jpg",
        itemCount: 3,
        price: 89.9,
        currency: "USD"
    }
})

// Solicitud de pago (PIX / método estático)
await sock.sendMessage(jid, {
    payment: {
        amount: 5000,               // en centavos (offset: 100)
        merchant: "Aethero Store",
        key: "pagos@aethero.com",
        currency: "BRL",
        body: "Pago de tu pedido"
    }
})

// Factura/invoice con botón "review_and_pay"
await sock.sendMessage(jid, {
    invoice: {
        title: "Factura #INV-001",
        subtitle: "Vence en 3 días",
        body: "Detalle de tu compra",
        image: "https://files.catbox.moe/factura.jpg",
        price: 25.5,
        currency: "USD",
        orderId: "INV_2026_001",
        itemName: "Camiseta Aethero",
        itemCount: 1
    }
}, { quoted: m.raw, mentions: [] })
```

### 6.11. Contextos Falsos (`fakeContextBuilder.js`)

A diferencia de los builders anteriores (que **envían** un mensaje), los "contextos falsos" **construyen un objeto de mensaje citable** (`{ key, message }`) sin enviarlo — se usan como valor de `options.quoted` en cualquier `sock.sendMessage()`, simulando que el bot responde a una tarjeta de orden, catálogo, pago, invoice o enlace que en realidad nunca fue enviada al chat. Se acceden directamente sobre `sock`:

```js
// Cita falsa de una "orden" — usado internamente por el propio framework
// para la notificación de arranque (core/main.js)
const fakeQ = await sock.fakeOrder(m.chat.id, {
    orderId: "AETHERO_V3",
    itemCount: 374,
    message: "Powered by Syllkom",
    orderTitle: "Aethero Store",
    price: 374,
    currency: "USD",
    image: "https://files.catbox.moe/obz4b4.jpg"
})

await sock.sendMessage(m.chat.id, {
    text: "Tu pedido ha sido despachado ✅"
}, { quoted: fakeQ })
```

```js
// Cita falsa de catálogo
const fakeCat = await sock.fakeCatalog(m.chat.id, {
    id: "P1", title: "Producto demo", body: "Descripción demo",
    price: 10, currency: "USD", image: "https://files.catbox.moe/demo.jpg"
})
await sock.sendMessage(m.chat.id, { text: "¿Te interesa este producto?" }, { quoted: fakeCat })
```

```js
// Cita falsa de solicitud de pago
const fakePay = await sock.fakePayment(m.chat.id, {
    price: 15, currency: "USD", message: "Pago pendiente"
})
await sock.sendMessage(m.chat.id, { text: "Recuerda completar tu pago" }, { quoted: fakePay })
```

```js
// Cita falsa de invoice
const fakeInv = await sock.fakeInvoice(m.chat.id, {
    title: "Factura demo", body: "Detalle", price: 20, currency: "USD",
    itemName: "Servicio Aethero"
})
await sock.sendMessage(m.chat.id, { text: "Tu factura está lista" }, { quoted: fakeInv })
```

```js
// Cita falsa de enlace con vista previa personalizada
const fakeLnk = await sock.fakeLink(m.chat.id, {
    url: "https://github.com/Syllkom",
    title: "Repositorio de Aethero",
    body: "Framework Event-Driven para WhatsApp",
    image: "https://files.catbox.moe/preview.jpg"
})
await sock.sendMessage(m.chat.id, { text: "Revisa este enlace" }, { quoted: fakeLnk })
```

### 6.12. `sock.sendSticker()` — Stickers WebP con EXIF personalizado

```js
await sock.sendSticker(m.chat.id, {
    sticker: { url: "https://files.catbox.moe/imagen.jpg" },   // o { sticker: Buffer }
    mediaType: 'image'          // 'image' | 'video' (video/gif animado → webp animado)
}, m.raw, {
    packname: "Aethero Stickers",
    author: "Syllkom",
    categories: ["🤖", "⚡"]
})
```

Internamente convierte el buffer a WebP 512×512 vía `fluent-ffmpeg` (`library/media/mediaConverter.js`) — para video recorta a los primeros 5 segundos, 15 FPS, sin audio (`-an`) y en loop — y luego incrusta el EXIF `sticker-pack-name` / `sticker-pack-publisher` / `emojis` usando `node-webpmux`.

```js
// Ejemplo de comando ".s" que convierte la imagen/video citado en sticker
export default {
    command: true, case: ['sticker', 's'],
    script: async (m, { sock }) => {
        const quotedMedia = m.quoted?.content
        if (!quotedMedia?.isMedia) return m.reply('Cita una imagen o video corto.')

        const buffer = await quotedMedia.download()
        await sock.sendSticker(m.chat.id, {
            sticker: buffer,
            mediaType: quotedMedia.mimeType.startsWith('video') ? 'video' : 'image'
        }, m.raw, { packname: 'Aethero', author: m.sender.name })
    }
}
```


### 6.13. Otras utilidades inyectadas sobre `sock`

| Método | Firma | Descripción |
|---|---|---|
| `sock.Baileys()` | `async () => module` | Devuelve el módulo `@whiskeysockets/baileys` completo vía `import()` dinámico (útil para acceder a `proto`, `WAMessageStubType`, etc. sin un import estático). |
| `sock.getBuffer(url)` | `async (string \| Buffer) => Buffer` | Descarga cualquier URL como `Buffer` vía `axios` (o la devuelve tal cual si ya es un `Buffer`). Si falla, devuelve `Buffer.alloc(0)` (nunca lanza). |
| `sock.downloadMedia(message, type)` | `async (rawMessage, 'buffer'\|'stream') => Buffer` | Wrapper sobre `downloadMediaMessage` de Baileys con **reintento automático** ante error `429` (espera 1.5s y reintenta una vez). |
| `sock.resizePhoto({ image, scale, result, fit })` | `async (opts) => Buffer \| string` | Redimensiona una imagen vía `Jimp`. `fit: 'cover'` (por defecto) recorta a cuadrado; `fit: 'contain'` escala sin recortar. `result: 'base64'` devuelve string en vez de `Buffer`. Ante error, devuelve un PNG transparente de 1×1 en vez de lanzar. |
| `sock.generateWMContent(opts)` | `(opts) => Promise` | Alias directo de `generateWAMessageContent` de Baileys, preconfigurado con `upload: sock.waUploadToServer`. Es la base que usan internamente todos los builders para subir imágenes/videos/documentos. |
| `sock.sendWAMContent(jid, message, options)` | `async (...) => result` | Genera un mensaje vía `generateWAMessageFromContent` y lo despacha directamente con `sock.relayMessage`, con un `messageId` autogenerado. |
| `sock.profilePictureUrl(jid, type)` | `async (jid, 'image'\|'preview') => url` | **Reimplementado** (no es el método nativo de Baileys): construye manualmente una consulta XML `iq` (`xmlns: 'w:profile:picture'`) — soporta JIDs `@lid` y `@g.us` vía el atributo `target`, con timeout de 4s. Lanza `'Foto privada o inexistente'` si no hay resultado (por eso en `m.chat`/`m.bot`/`m.sender` siempre se envuelve en `.catch(() => 'https://files.catbox.moe/obz4b4.jpg')`). |
| `sock.updateProfilePicture` / `sock.groupUpdateProfilePicture` | *(alias)* | Apuntan a la **misma** función que `sock.profilePictureUrl` (reemplazo total del comportamiento nativo de Baileys para estos tres nombres). |
| `sock.getJSON(url)` | `async (url) => object \| 0` | Petición GET vía `got` con `timeout: 10s` y 2 reintentos automáticos. Devuelve `0` (no `null`) si falla. |
| `sock.loadMessage(jid, id)` | `async (jid, id) => rawMessage \| null` | Busca un mensaje histórico por `id` dentro del shard `@history/<jid>/<senderId>` — requiere `global.config.saveHistory === true`. Devuelve `null` si el historial está desactivado o no se encuentra. |
| `sock.relayMessage` *(interceptado)* | — | Antes de delegar al `relayMessage` original de Baileys, inyecta el nodo `{ tag:'bot', attrs:{ biz_bot:'1' } }` en chats privados si `global.config.iconAI === true`. |
| `sock.sendMessage` *(interceptado)* | — | Punto central de despacho: sanea `options.quoted` (acepta objetos con `.raw` del framework, elimina citados sin `.key` válido), enruta las claves especiales de esta sección, e inyecta el nodo `bot` igual que `relayMessage` cuando corresponde. Si `content` no coincide con ninguna clave especial, delega al `sendMessage` original de Baileys sin modificar el comportamiento estándar. |


---

## 7. Sistema de Flujos Conversacionales (`sock.setReplyHandler`)

Aethero permite registrar "manejadores de respuesta" sobre un mensaje específico: la próxima vez que **alguien cite ese mensaje**, el framework ejecuta lógica personalizada en lugar de (o antes de) tratar el mensaje como un comando normal. Este sistema combina dos piezas:

- **`sock.setReplyHandler(message, options, expiresIn)`** (`library/socketExtensions.js`) — registra el manejador.
- **`m.pre.parser.handler.js`** (`priority: 1.5`) — intercepta cada mensaje entrante que **cita** un mensaje con manejador registrado, y ejecuta las rutas correspondientes.

### 7.1. Cómo se almacena

Cada manejador se guarda en el shard de base de datos `@reply:Handler`, indexado por el `id` del mensaje que se quiere "escuchar":

```js
sock.setReplyHandler = async (message, options = {}, expiresIn = 1000 * 60 * 15) => {
    // message.key.id es la clave de indexado
    // options.lifecycle.{createdAt, expiresAt} se calculan a partir de expiresIn
    // options.routes[].code.{guard, executor}, SI son funciones, se serializan con .toString()
    const db = await $base.open('@reply:Handler')
    db[message.key.id] = options
}
```

> **Importante — Serialización de funciones:** `guard` y `executor` se convierten a **texto** (`Function.prototype.toString()`) antes de guardarse, y se **evalúan de nuevo con `eval()`** cuando llega la respuesta (`m.pre.parser.handler.js`). Esto significa que **no pueden depender de closures** (variables externas capturadas por referencia) — todo lo que necesiten debe llegarles a través de los parámetros que el propio framework les inyecta (`m`, `{ state, lifecycle, security, route, sock, modules }`) o de variables verdaderamente globales.

### 7.2. Estructura completa de `options`

```js
{
    security: {
        userId: 'all' | '<jid_específico>',    // quién puede responder
        chatId: 'all' | '<jid_específico>',     // en qué chat es válido
        scope: 'all' | 'private' | 'group'      // restringe por tipo de chat
    },
    lifecycle: {
        // createdAt / expiresAt se autocalculan a partir de expiresIn — no los definas manualmente
        consumeOnce: true   // si true, el manejador se borra tras la primera ejecución exitosa
    },
    state: {
        // objeto arbitrario, disponible dentro de guard/executor como "state"
    },
    routes: [
        {
            priority: 1,               // rutas se evalúan en orden ascendente
            code: {
                guard: (m, ctx) => Boolean,     // si devuelve true → SALTA esta ruta
                executor: async (m, ctx) => any // si el valor devuelto !== false → se considera "manejado"
            }
        }
    ]
}
```

`ctx` (segundo argumento de `guard`/`executor`) es siempre `{ state, lifecycle, security, route, sock, modules }`.

### 7.3. Ejemplo completo: encuesta simple por respuesta

```js
// plugins/general/encuesta.plugin.js
export default {
    command: true, case: 'encuesta',
    description: 'Crea una encuesta de sí/no respondida por citación.',
    category: 'general',
    usage: ['encuesta ‹pregunta›'],
    script: async (m, { sock }) => {
        if (!m.text) return m.reply('Uso: .encuesta ¿Les gusta Aethero?')

        const sent = await m.reply(
            `📊 *Encuesta:* ${m.text}\n\nResponde citando este mensaje con *sí* o *no*.`
        )

        await sock.setReplyHandler(sent, {
            security: { scope: 'all', userId: 'all', chatId: m.chat.id },
            lifecycle: { consumeOnce: false },   // se puede votar varias veces (demo)
            state: { yes: 0, no: 0, question: m.text },
            routes: [
                {
                    priority: 1,
                    code: {
                        guard: (m) => {
                            const t = (m.content.text || '').trim().toLowerCase()
                            return !['si', 'sí', 'no'].includes(t)   // true = ignorar esta ruta
                        },
                        executor: async (m, { state }) => {
                            const answer = m.content.text.trim().toLowerCase()
                            if (answer === 'no') state.no++
                            else state.yes++

                            await m.reply(
                                `✅ Voto registrado.\n👍 Sí: ${state.yes}  |  👎 No: ${state.no}`
                            )
                            return true   // "manejado" → detiene el resto del pipeline para este mensaje
                        }
                    }
                }
            ]
        }, 1000 * 60 * 30)   // expira en 30 minutos
    }
}
```

**Flujo de ejecución cuando alguien responde:**

1. Llega el mensaje citando `sent`.
2. `m.pre.parser.handler.js` (priority `1.5`) encuentra la entrada en `@reply:Handler` bajo `m.quoted.id`.
3. Valida `security` (¿coincide el `userId`/`chatId`/`scope` esperado?) y `lifecycle` (¿ya expiró?).
4. Recorre `routes` ordenadas por `priority`; para cada una, evalúa `guard` — si devuelve `true`, la salta.
5. Ejecuta el `executor` de la primera ruta cuyo `guard` no bloqueó. Si el resultado no es literalmente `false`, marca el mensaje como manejado: `control.end = true` (el pipeline se detiene aquí — **no** llegará a `func.plugins.handler.js`, es decir, no se interpretará también como un comando).
6. Si `lifecycle.consumeOnce` es `true`, el registro se elimina de `@reply:Handler` tras esta ejecución.

Si el manejador expiró (`lifecycle.expiresAt < Date.now()`), el framework responde automáticamente *"El tiempo límite para responder a este mensaje ha finalizado."* y elimina el registro.


---

## 8. Desarrollo de Plugins y Scrapers

### 8.1. Plugin de comando normal

Un plugin de comando es un archivo `<algo>.plugin.js` dentro de `./plugins/` (en cualquier subcarpeta) que exporta por defecto un objeto con, como mínimo, `command: true` y `case`. Los valores por defecto que el `ModuleRegistry` fusiona automáticamente (definidos en `index.js`) son `{ usePrefix: true, stubtype: false, command: false }` — por eso **es obligatorio declarar `command: true` explícitamente** para que el enrutador (`func.plugins.handler.js`) lo reconozca.

```js
// plugins/general/ping.plugin.js
export default {
    command: true,
    usePrefix: true,                 // requiere el prefijo (. ¿ ? ¡ ! # % & / , ~ @)
    case: ['ping', 'p'],             // acepta cualquiera de estos alias
    description: 'Comprueba la latencia del bot.',
    category: 'general',
    usage: ['ping'],
    script: async (m, { sock, plugin, plugins, scraper, scrapers, modules }) => {
        const start = Date.now()
        const sent = await m.reply('🏓 Calculando...')
        const ms = Date.now() - start
        await sock.sendMessage(m.chat.id, { text: `🏓 Pong! \`${ms}ms\`` }, { edit: sent.key })
    }
}
```

**Metadatos reconocidos por el sistema:**

| Campo | Tipo | Uso |
|---|---|---|
| `command` | `boolean` | **Obligatorio en `true`** para que el archivo se trate como comando. |
| `case` | `string \| string[]` | Alias por los que se invoca el comando (comparado contra `m.command`). |
| `usePrefix` | `boolean` | Si `true`, solo responde con prefijo; si `false`, solo responde sin prefijo. |
| `description` | `string` | Usado por `library/pluginInspector.js` en menús de ayuda autogenerados. |
| `category` | `string \| string[]` | Categoría legada, usada por `listCategoryUsage()`. |
| `usage` | `string \| string[]` | Ejemplos de uso legados, mostrados en menús de ayuda. |
| `list` | `array` | Formato moderno de múltiples sub-comandos dentro de un mismo archivo: `[{ category, usage/text/cmd }]`. |
| `priority` | `number` | Solo relevante para plugins `before: true` o `stubtype: true` (orden de ejecución). |
| `script` | `function` | `(m, { sock, plugin, plugins, scraper, scrapers, modules }) => any` |

El objeto de contexto que recibe `script` como segundo argumento en un comando incluye **tanto** `plugin`/`plugins` como `scraper`/`scrapers` (alias duplicados intencionales que apuntan a la misma carpeta registrada — usa el que prefieras estilísticamente).

### 8.2. Plugin middleware de evento (`before: true`)

Un plugin `before: true` se ejecuta **para cada mensaje entrante**, antes de que se resuelva cualquier comando — ideal para antilink, antibot, autodescarga de enlaces, o bloqueo de palabras. Se ejecutan en orden ascendente de `priority` (propio de estos plugins, no el `priority` del handler).

```js
// plugins/middleware/antilink.plugin.js
export default {
    before: true,
    priority: 1,
    script: async (m, { sock, control, modules }) => {
        if (!m.chat.isGroup) return
        if (m.sender.isAdmin || m.sender.role('root', 'owner', 'mod')) return

        const linkRegex = /chat\.whatsapp\.com\/[A-Za-z0-9]+/i
        if (!linkRegex.test(m.content.text || '')) return

        if (!m.bot.isAdmin) return   // no se puede eliminar mensajes sin ser admin

        await sock.sendMessage(m.chat.id, { delete: m.raw.key })
        await m.chat.remove(m.sender.id)
        await m.reply('🚫 Enlaces de grupo no permitidos. Usuario expulsado.')

        control.end = true   // detiene el resto del pipeline para este mensaje
    }
}
```

> A diferencia de los plugins de comando, aquí `script` se invoca como `plugin.script(this, { sock, control, modules })` desde `func.before.handler.js` — el primer argumento sigue siendo `m`, pero además recibes `control` para poder cortar el pipeline manualmente (por ejemplo, para evitar que el mismo mensaje además dispare un comando).

### 8.3. Plugin de evento de grupo (`stubtype: true`)

Reacciona a eventos nativos de WhatsApp (promociones, expulsiones, cambios de nombre/foto de grupo, etc.), identificados por `proto.WebMessageInfo.StubType` de Baileys. `func.stubtype.handler.js` traduce el código numérico de `m.raw.messageStubType` a su nombre textual y consulta los plugins `stubtype: true` cuyo `case` (array) incluya ese nombre.

```js
// plugins/events/welcome.plugin.js
export default {
    stubtype: true,
    case: ['GROUP_PARTICIPANT_ADD'],
    script: async (m, { sock, control, parameters, even, modules }) => {
        // "even" es el nombre real de la propiedad inyectada por el framework
        // (parámetro con el nombre del evento, p.ej. "GROUP_PARTICIPANT_ADD")
        const newMembers = parameters   // array de JIDs añadidos
        for (const jid of newMembers) {
            await sock.sendMessage(m.chat.id, {
                text: `👋 ¡Bienvenido/a @${jid.split('@')[0]} a *${m.chat.name}*!`,
                contextInfo: { mentionedJid: [jid] }
            })
        }
    }
}
```

> **Nota de compatibilidad:** el framework inyecta el nombre del evento bajo la clave `even` (no `event`) en el objeto de contexto — verifícalo al desestructurar los argumentos de tu `script` para evitar `undefined` por una simple errata de tipeo.


### 8.4. Crear y consumir un Scraper (`.scraper.js`)

Los scrapers viven bajo `./library/scrapers/` (registrados en `index.js` con sufijo `.scraper.js` y `defaultContext: { enable: true }`), y comparten el mismo motor de Hot-Reload que plugins y handlers — cualquier archivo que agregues, edites o borres ahí se recarga en caliente sin reiniciar el bot.

El repositorio incluye un scraper de referencia, `library/scrapers/tools/danbooru.scraper.js`, que expone **exports nombrados directos** (sin envoltorio):

```js
// library/scrapers/tools/danbooru.scraper.js (firma pública real)
export async function getRandomCharacter(tags = '') { /* ... */ }
export async function getPost(id) { /* ... */ }
export async function getTagInfo(tagName) { /* ... */ }
export async function getRandomVideo(tags = '') { /* ... */ }
```

`ModuleFolder` (`core/library/modules.js`) expone dos formas de recuperar un módulo, y **cada estilo de export requiere una forma distinta de consumo**:

#### Estilo A — Exports nombrados directos (como `danbooru.scraper.js`)

Cuando un archivo `.scraper.js` no tiene `export default`, el registro guarda el objeto completo de exports nombrados bajo la ruta relativa del archivo. Se recupera con **`scrapers.file(rutaRelativa)`**, no con `.import()`:

```js
// plugins/general/randomchar.plugin.js
export default {
    command: true, case: 'randomchar',
    script: async (m, { scrapers }) => {
        const danbooru = scrapers.file('tools/danbooru.scraper.js')
        if (!danbooru) return m.reply('Scraper no disponible.')

        const result = await danbooru.getRandomCharacter()
        if (!result) return m.reply('No se encontró ningún resultado.')

        await m.reply(
            `🎴 *${result.name}*\n📖 Fuente: ${result.source}\n🖌️ Artista: ${result.artist}\n⭐ Favoritos: ${result.favs}`
        )
    }
}
```

#### Estilo B — Convención `.export` (habilita `scrapers.import('clave')`)

Si en cambio quieres poder resolver funciones individuales por nombre corto con `scrapers.import('clave')` (sin conocer la ruta del archivo), estructura tu scraper con un `export default` que contenga una propiedad `export`:

```js
// library/scrapers/tools/miapi.scraper.js
async function fetchQuote() { /* ... */ }
async function fetchFact() { /* ... */ }

export default {
    export: {
        fetchQuote,
        fetchFact
    }
}
```

```js
// Consumo — ahora sí funciona .import() por clave, sin conocer la ruta del archivo
export default {
    command: true, case: 'frase',
    script: async (m, { scrapers }) => {
        const fetchQuote = scrapers.import('fetchQuote')
        if (!fetchQuote) return m.reply('Scraper no cargado todavía.')
        const quote = await fetchQuote()
        await m.reply(quote)
    }
}
```

> **Por qué importa esta distinción:** `ModuleFolder.import(query)` solo consulta el `Map` interno `exports` cuando `query` es un `string` — y ese `Map` **solo** se puebla a partir de una propiedad `module.export` (singular) presente en el `export default` del archivo. El scraper de ejemplo incluido en el framework (`danbooru.scraper.js`) **no** sigue esa convención — usa exports nombrados de ES Modules directamente — por lo que debe consumirse con `.file(rutaRelativa)`. Si vas a escribir tus propios scrapers y quieres la ergonomía de `scraper.import('nombre')`, adopta el patrón del Estilo B.

### 8.5. Referencia completa: `plugins/owner/shell.plugin.js`

El repositorio incluye un plugin de comando completo y funcional que sirve como referencia de todos los patrones descritos en esta sección: protección por rol (`m.sender.role`), reacciones de estado (`m.react`), y respuesta con manejo de errores (`m.reply`).

```js
// plugins/owner/shell.plugin.js
import { exec } from 'child_process'
import util from 'util'

const execPromise = util.promisify(exec)

export default {
    command: true, usePrefix: false,
    case: ['>', '=>', '$'],
    description: 'Ejecuta código asíncrono (JavaScript) y comandos de consola (Shell).',
    category: 'owner',
    usage: ['> ‹script›', '=> ‹return script›', '$ ‹shell›'],
    script: async (m, { sock, modules }) => {
        if (!m.sender.role('root', 'owner')) return m.sms('owner')

        try {
            if (m.body.startsWith('=>') || m.body.startsWith('>')) {
                await m.react('wait')
                const isAutoReturn = m.body.startsWith('=>')
                const codeRaw = m.body.slice(isAutoReturn ? 2 : 1).trim()
                const code = isAutoReturn ? `return (${codeRaw})` : codeRaw

                const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor
                const print = (...args) => m.reply(util.format(...args))
                const execCode = new AsyncFunction('m', 'sock', 'modules', 'global', 'print', 'db', code)

                let result = await execCode(m, sock, modules, global, print, global.db)
                if (typeof result !== 'undefined') {
                    if (typeof result !== 'string') result = util.inspect(result, { depth: 2 })
                    await m.reply(result)
                }
                await m.react('done')
            } else if (m.body.startsWith('$')) {
                await m.react('wait')
                const { stdout, stderr } = await execPromise(m.body.slice(1).trim())
                await m.reply((stdout || stderr || 'No output').trim())
                await m.react('done')
            }
        } catch (err) {
            await m.react('error')
            await m.reply(`ⓘ *Excepción atrapada:*\n\n${String(err)}`)
        }
    }
}
```

Este plugin acepta tres prefijos **sin requerir** el carácter de prefijo global (`usePrefix: false`): `>código` (ejecuta), `=>expresión` (ejecuta y retorna el valor de la expresión) y `$comando` (ejecuta en el shell del sistema operativo). Está protegido por `m.sender.role('root', 'owner')` — solo usuarios definidos en `global.config.userRoles` (o promovidos vía `m.setRole`) pueden invocarlo.


---

## 9. Apéndice: Referencia Rápida de Ficheros

### 9.1. `index.js` — Definición real del `MODULEREGISTRY`

Este es el archivo que determina qué carpetas se registran, con qué sufijo y qué contexto por defecto reciben sus módulos. Es el punto de entrada del **proceso padre**:

```js
// ./index.js
await import('./config.js')

import path from 'path'
import { CoreI } from './core/index.js'

const bot = new CoreI(null, {
    STORAGE: path.resolve('./storage'),
    CONFIG: path.resolve('./config.js'),
    MODULEREGISTRY: [
        {
            folder: path.resolve('./plugins'),
            suffix: '.plugin.js',
            defaultContext: { usePrefix: true, stubtype: false, command: false }
        },
        {
            mainLogic: true,                       // ← este folder ejecuta el pipeline de mensajes
            folder: path.resolve('./handlers'),
            suffix: '.handler.js',
            defaultContext: { enabled: true }
        },
        {
            folder: path.resolve('./library/scrapers'),
            suffix: '.scraper.js',
            defaultContext: { enable: true }
        },
        {
            folder: path.resolve('./library'),
            suffix: '.extensions.js',
            defaultContext: { enable: true }
        },
        {
            folder: path.resolve('./library/builders'),
            suffix: '.builder.js',
            defaultContext: { enable: true }
        }
    ]
})

await bot.start()
```

> Solo **una** carpeta puede llevar `mainLogic: true` — es la que `core/main.js` usa como fuente del pipeline de mensajes (`modules.getFolder(mainFolderName)` → `mainLogic.query({ enabled: true })` en cada mensaje entrante). En la configuración por defecto, es `./handlers`.

Nótese también los dos registros adicionales con sufijo `.extensions.js` (bajo `./library`) y `.builder.js` (bajo `./library/builders`) — ambos con Hot-Reload activo por el mismo mecanismo, pensados para que puedas añadir tus propias extensiones de socket o builders de mensajes personalizados sin tocar `socketExtensions.js` directamente, simplemente creando un archivo nuevo con el sufijo correspondiente en la carpeta indicada.

### 9.2. `package.json` — Dependencias principales

```json
{
  "name": "Aethero",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "build": "npm install && node index.js"
  },
  "author": "Syllkom",
  "license": "MIT",
  "engines": { "node": ">=18.0.0" },
  "repository": { "type": "git", "url": "git+https://github.com/Syllkom/Aethero.git" }
}
```

Dependencias clave: `@whiskeysockets/baileys` (motor WhatsApp), `@syllkom/hyper-db` (LMDB), `@hapi/boom`, `chokidar` (Hot-Reload), `jimp` / `@napi-rs/canvas` (imágenes), `fluent-ffmpeg` / `ffmpeg-static` (media), `node-webpmux` (stickers EXIF), `got` / `axios` (HTTP), `chalk` (consola), `qrcode` / `qrcode-terminal` (vinculación), `pino` (logging de Baileys), `dotenv`, `lodash`, `moment-timezone`.

### 9.3. `library/pluginInspector.js` — Introspección para menús de ayuda

Utilidad independiente (no forma parte del pipeline de mensajes) para construir menús de ayuda dinámicos a partir de los metadatos de tus plugins:

```js
import { inspectPlugins, listCategoryUsage, countTotalCommands } from '../library/pluginInspector.js'

const { items } = await inspectPlugins(path.resolve('./plugins'))
const total = countTotalCommands(items)
const generalCommands = listCategoryUsage(items, { category: 'general', withPrefix: true })

console.log(`Total de comandos: ${total}`)
console.log(generalCommands)
```

Reconoce tanto el formato de metadatos legado (`category` + `usage` como strings/arrays sueltos en la raíz del plugin) como el formato moderno de sub-comandos múltiples por archivo (`list: [{ category, usage|text|cmd }]`).

### 9.4. `library/garbageCollector.js` — Limpieza automática

Se ejecuta una única vez al importarse (efecto secundario en `core/main.js`: `import '../library/garbageCollector.js'`) y programa un `setInterval` que **cada 60 segundos** vacía por completo el contenido de `./storage/temp` — la carpeta usada por los conversores de media (`giftConverter.js`, `mediaConverter.js`) para archivos intermedios de FFmpeg.

### 9.5. `library/media/giftConverter.js` — GIF → MP4

```js
import { gifToMp4 } from '../library/media/giftConverter.js'

const mp4Buffer = await gifToMp4(gifBuffer)
await sock.sendMessage(m.chat.id, { video: mp4Buffer, gifPlayback: true }, { quoted: m.raw })
```

Usa `fluent-ffmpeg` con `-movflags faststart -pix_fmt yuv420p` y forzado de dimensiones pares (`scale=trunc(iw/2)*2:trunc(ih/2)*2`), requisito de compatibilidad de muchos decodificadores H.264.

---

## Créditos

**Aethero Framework** — creado por **Syllkom**. Licencia **MIT**. Motor de conexión provisto por [`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys).

