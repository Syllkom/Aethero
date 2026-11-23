# Almacenamiento y sesión

Todo se guarda bajo `storage/` (ignorada por git, creada automáticamente).

```
storage/
├── creds/main/session.sqlite     Sesión de WhatsApp del bot principal
├── store/                        Base de datos del bot (HyperDB)
├── temp/                         Archivos temporales (se vacía cada 60 s)
└── subs/<id>/…                   Sub-bots: sesión (gestionada por baileys-ipc) y store/
```

## Sesión de WhatsApp ✅

`core/library/hyperDBAuth.js` guarda credenciales y claves Signal con `node:sqlite`:

- Tablas `creds` (`id`, `value`) y `keys` (`type`, `id`, `value`).
- Modo WAL y `synchronous = NORMAL`; cada clave es una fila, así que no se reescribe un archivo entero por mensaje.
- Los valores se serializan con `BufferJSON` de Baileys.
- **Migración automática:** si existe un `session.json` antiguo y no hay sesión en SQLite, se importa y el archivo se renombra a `session.json.bak`.

⚠️ Los errores al guardar claves se tragan en silencio (`catch {}` / `ROLLBACK`). Si ves fallos de descifrado ("Bad MAC") sin causa aparente, revisa permisos y espacio de `storage/creds`.

### Cuándo se borra la sesión

Al recibir `loggedOut`, `badSession`, `multideviceMismatch` o `forbidden`, el framework elimina **toda** `storage/creds`. Haz copia de `session.sqlite` si te importa conservarla.

## Base de datos (HyperDB)

`@syllkom/hyper-db` es una base NoSQL **sin dependencias nativas** (no es LMDB, como decía el README anterior): objetos JS con persistencia transparente mediante proxies, fragmentación automática en archivos binarios y escritura diferida. Configuración usada por Aethero:

```js
new HyperDB({ folder, memory: 64, depth: 2,
  maps:  { threshold: 20, debounce: 1000 },
  nodes: { threshold: 10, debounce: 500 } })
```

Aethero añade dos métodos:

- `db.start()`: log de arranque.
- `await db.open('<shard>')`: devuelve (y crea si no existe) un objeto mutable. No hay `save()`: los cambios se escriben solos.

```js
const users = await global.db.open('@users')
users['51999999999@lid'] ??= { name: '', banned: false, roles: {} }
users['51999999999@lid'].banned = true   // persistido automáticamente
```

### Shards usados por el framework ✅

| Shard | Contenido |
|---|---|
| `@users` | Perfil por usuario: `{ name, banned, roles }`. También guarda registros de chats privados. |
| `@chat:<jid de grupo>` | Datos libres por grupo; además `savedMetadata` con los metadatos del grupo. |
| `@reply:Handler` | Flujos de respuesta pendientes. Ver [Flujos de respuesta](reply-flows.md). |
| `@history/<jid>` | Índice `msgId → senderId` del chat. |
| `@history/<jid>/<senderId>` | `{ data: [...] }` con hasta 500 mensajes crudos. |
| `@viewonce_cache` | Caché de mensajes "ver una vez" (máx. 50). ⚠️ Su handler hoy no se carga, ver [Handlers](handlers.md#handlers-incluidos). |
| `@plugins_db[:<usuario>]` | Base por defecto de los plugins de reacción. |

### Alcance por sub-bot

`global.db` es un *proxy*: durante el pipeline de un sub-bot apunta a la base de ese sub-bot (`storage/subs/<id>/store`), no a la del bot principal. Así, el mismo plugin guarda datos separados en cada número.

## Historial de mensajes

Con `saveHistory: true`, cada mensaje entrante y saliente se guarda en `@history/...` (máx. 500 por usuario y chat). Sirve para:

- `sock.loadMessage(jid, id)`.
- Completar `m.quoted` con el mensaje original en vez del fragmento que viene en la cita.

Si ocupa demasiado, desactívalo en `config.js`.

## Temporales

`library/garbageCollector.js` borra cada 60 s todo lo que haya en `storage/temp/`. No guardes ahí nada que deba durar.
