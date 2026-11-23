# Arquitectura

## Visión general

```
┌──────────────── PROCESO PADRE (index.js) ────────────────┐
│ config.js → CoreI → ForkManager                           │
│   · muestra el menú de vinculación si no hay sesión       │
│   · lanza core/main.js con --max-old-space-size=512       │
│   · si el hijo termina (cualquier motivo): espera 2 s     │
│     y lo vuelve a lanzar                                  │
└───────────────────────────┬──────────────────────────────┘
                            │ fork + IPC (JSON)
┌───────────────────────────▼──────────────────────────────┐
│ PROCESO HIJO (core/main.js)                               │
│  HyperDB ─ ModuleRegistry (chokidar) ─ MakeClient (Baileys)│
│                                                           │
│  messages.upsert → arma `m` → handlers por priority → plugin│
│  + gestor de sub-bots (workers, ver subbots.md)           │
└──────────────────────────────────────────────────────────┘
```

## Los dos procesos

**Padre (`index.js` + `core/index.js`).** Solo supervisa: pregunta cómo vincular (si hace falta), lanza el hijo y lo relanza tras 2 segundos cuando termina. Recibe del hijo los eventos de conexión (`open`, `close`, `pairing`) y los imprime.

**Hijo (`core/main.js`).** Arranca la base de datos, el registro de módulos y el cliente de WhatsApp, y ejecuta el pipeline. Tiene un tope de heap de 512 MB (`--max-old-space-size=512`) ✅.

Consecuencia: un fallo grave en el hijo no tumba al supervisor. Pero ⚠️ el padre relanza **sin límite ni espera creciente**: un error que ocurra siempre al arrancar produce un bucle de reinicios cada 2 s.

## Conexión y reconexión

`core/library/waClient.js` clasifica cada cierre de conexión por su `statusCode`:

| Grupo | Códigos de Baileys | Qué ocurre |
|---|---|---|
| Reintentable | `restartRequired`, `connectionLost`, `connectionClosed` (428), `unavailableService`, `timedOut` | Emite `restart`; `main.js` llama a `mainBot.restart()` (espera 2 s y reconecta con la sesión guardada). |
| Sesión terminada | `loggedOut`, `badSession`, `multideviceMismatch`, `forbidden` | Cierra el socket y **borra `storage/creds`**. Hay que vincular de nuevo. |
| Reemplazada | `connectionReplaced` | Cierra el socket sin borrar credenciales (otra instancia usa la sesión). |
| Otro | cualquier otro código | Emite `error`; si es 428 se reconecta igual que en el primer grupo. |

**Segunda capa.** Si el pipeline de handlers lanza un error con `statusCode 774` o `output.statusCode 428`, `main.js` lanza `Error('Tumba la casa mami')` a propósito. Ese error sale de un listener asíncrono, queda como *unhandled rejection* y termina el proceso hijo, tras lo cual el padre lo relanza. ⚠️ Depende de que Node trate las rechazos no capturados como fatales (comportamiento por defecto desde Node 15).

## Registro de módulos y hot-reload

`ModuleRegistry` (`core/library/modules.js`) vigila con `chokidar` las carpetas de `MODULEREGISTRY` ✅:

1. Un archivo nuevo o modificado se re-importa con `import(url + '?update=' + Date.now())` tras un debounce de 300 ms.
2. Si su nombre termina con el sufijo de la carpeta (`.plugin.js`, `.handler.js`…), se registra como módulo: se le aplican los valores por defecto y se guarda en memoria.
3. Si se borra, se elimina del registro.

Los plugins y handlers se **consultan en cada mensaje**, por lo que una recarga se nota de inmediato.

### Límites del hot-reload

- ⚠️ **Memoria.** Node no libera los módulos ESM cargados con URLs distintas: cada recarga deja la versión anterior en memoria hasta que el proceso termina. Con muchas ediciones en una sesión larga conviene reiniciar.
- ⚠️ **Dependencias.** Solo se recarga el archivo que cambió; los módulos que ese archivo importa (`import x from '../library/...'`) siguen en caché.
- ⚠️ **Extensiones del socket y builders.** `library/socket.extensions.js` se aplica una vez, al abrir la conexión, e importa los builders de forma estática. Editarlos **no tiene efecto hasta reiniciar el bot**.
- Los scrapers (`scrapers.file(...)`/`scrapers.import(...)`) y los plugins sí reflejan los cambios al instante.

## Pipeline de mensajes

Para cada mensaje entrante, `main.js`:

1. Resuelve los envoltorios (`viewOnce`, `ephemeral`, `edited`…) con `resolveMessage`.
2. Construye `m` con `key`, `message`, `type`, `category`, `contextInfo`, etc. Si cita otro mensaje, construye `m.quoted` (completándolo desde el historial si `saveHistory` está activo).
3. Ordena los handlers habilitados por `priority` ascendente y los ejecuta **en serie** con `handler.script.call(m, { sock, control, modules })`.
4. Se detiene si algún handler pone `control.end = true`.

Cada handler enriquece `m`; el último (`Infinity`) interpreta el comando y llama al plugin. Tabla completa en [Handlers](handlers.md).

⚠️ Como la ejecución es en serie y con `await`, un plugin lento retrasa el procesamiento de los mensajes que vienen detrás en el mismo lote.

## Llamadas

Si `antiCall` está activo, cada oferta de llamada se rechaza salvo que el número esté en `antiCallWhitelist`. Ver el aviso sobre el valor por defecto en [Configuración](configuration.md).

## Sub-bots

Cada sub-bot corre en un worker (`worker_threads`) propio con su sesión y base de datos, y ejecuta **el mismo pipeline** con su propio `sock`. Ver [Sub-bots](subbots.md).

## Observación sobre la base de datos

`config.js` importa el adaptador de la base de datos, y `config.js` se carga tanto en el padre como en el hijo. ⚠️ Eso significa que el adaptador (y por tanto una instancia de HyperDB sobre `storage/store`) se inicializa en **los dos procesos**. Hoy solo el hijo la usa activamente; evita leer o escribir `global.db` desde el padre.
