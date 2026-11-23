# Objeto de mensaje `m`

`m` se construye en `core/main.js` y **crece** al pasar por los [handlers](handlers.md). Cada sección indica desde qué prioridad existe cada parte.

## Base (antes de cualquier handler) ✅

| Propiedad | Contenido |
|---|---|
| `m.key`, `m.id` | Clave e ID del mensaje. |
| `m.raw` | Mensaje crudo de Baileys (getter). |
| `m.message` | `message` crudo. |
| `m.type`, `m.category` | Tipo (`extendedTextMessage`, `imageMessage`…) y categoría tras desenvolver `viewOnce`/`ephemeral`/`edited`. |
| `m.messageData` | Contenido ya desenvuelto (getter). |
| `m.contextInfo` | `contextInfo` del mensaje. |
| `m.messageTimestamp`, `m.broadcast`, `m.pushName` | Metadatos. |
| `m.quoted` | Solo si cita otro mensaje: `key`, `id`, `type`, `category`, `messageData`, `contextInfo`, `message`, `raw`, `fullRaw` (del historial, si existe), `fakeObj`. |

## `m.content` · 0.02 ✅

```js
m.content = {
    isMedia,      // true | undefined (imagen, video, audio, documento, sticker, ptv)
    text,         // texto, caption, botón pulsado o respuesta interactiva
    args,         // text.split(/ +/)
    media         // si isMedia: { mimeType, fileName, download(type = 'buffer') }
}
```

`m.quoted.content` tiene la misma forma. Texto reconocido: `conversation`, captions de imagen/video, `extendedTextMessage`, `buttonsResponseMessage`, `templateButtonReplyMessage`, `interactiveResponseMessage` (lee `paramsJson.id`) y el nombre de encuestas.

```js
const buffer = m.content.isMedia
    ? await m.content.media.download()
    : await m.quoted?.content?.media?.download()
```

## `m.chat` · 0.05 ✅

```js
m.chat.id          // JID del chat
m.chat.isGroup
m.chat.db()        // grupo → shard '@chat:<id>'; privado → registro en '@users'
await m.chat.metaData()   // metadatos del grupo (caché de 5 min; si la consulta falla usa la última copia guardada)
```

En **grupos** (los metadatos ya están cargados al llegar a tu plugin):

- Getters: `size`, `desc`, `name`, `created`, `participants`, `owner`, `admins`.
- Acciones: `add(user)`, `remove(user)`, `promote(user)`, `demote(user)`, `setPhoto(img)`, `setDesc(txt)`, `setName(txt)`, `getPhoto()`, `getCodeInvite()`, `getLinkInvite()`, `revoke()`.
- Ajustes: `settings.lock(bool)`, `settings.announce(bool)`, `settings.memberAdd(bool)`, `settings.joinApproval(bool)`.

En **privados**: `getDesc()`, `getPhoto()`.

## `m.bot` · 0.10 ✅

```js
m.bot.id, m.bot.user, m.bot.number, m.bot.name, m.bot.fromMe
m.bot.isAdmin        // ¿es admin en este grupo?
m.bot.roles          // { root, owner, mod, vip: siempre true, admin }
m.bot.role('root')   // true si alguno de los roles está activo
```

Acciones: `getDesc()`, `getPhoto()`, `setPhoto(img)`, `setDesc(txt)`, `setName(txt)`, `join(link)`, `mute(id, bool, ms = 8h)`, `block(id, bool)`.

## `m.sender` · 0.12 ✅

```js
m.sender.id           // JID (preferentemente @lid)
m.sender.number
m.sender.name
m.sender.user         // "@número", listo para mencionar
m.sender.mentioned    // JIDs mencionados en el mensaje
m.sender.isAdmin      // requiere metadatos de grupo
m.sender.roles        // { root, owner, mod, vip, bot, admin }
m.sender.role('root', 'owner')   // true si alguno está activo
await m.sender.db()   // registro en '@users'
await m.sender.getPhoto(); await m.sender.getDesc()
```

**Cómo se calculan los roles** en cada mensaje:

1. Se abre (o crea) el registro del remitente en `@users`.
2. Se **fusionan** encima los roles de `global.config.userRoles` (por JID o por número). Los de configuración prevalecen.
3. Si el mensaje es del propio bot, se fuerza `root`, `owner`, `mod`, `vip` y `bot`.

## Métodos de `m` · 0.15 ✅

| Método | Qué hace |
|---|---|
| `m.reply(texto \| objeto, opciones)` | Responde citando el mensaje. Detecta `@números` y los menciona. Con objeto, lo pasa a `sock.sendMessage` (útil con [builders](builders-reference.md)). Ver nota abajo. |
| `m.react(alias \| emoji)` | Reacciona. Los alias salen de `global.REACT_EMOJIS` (`wait`, `done`, `error`). |
| `m.sms(tipo)` | Responde con `global.MSG[tipo]`. |
| `m.db(jid)` | Grupo → `@chat:<jid>`; usuario → registro en `@users` (lo crea). |
| `m.setBan(jid, estado = true)` | Marca `banned`. |
| `m.setRole(jid, estado, ...roles)` | Activa o revoca roles en la base de datos. |
| `m.getQuotedText()` | Texto del mensaje citado. |
| `await m.getQuotedMedia()` | Buffer del medio citado, o `null`. |

**Comportamiento de `m.reply` según `config.humanizer`:**

- `true`: simula "escribiendo…" (≈25 ms por carácter, máx. 2,5 s, más hasta 300 ms al azar) y envía texto normal con `sock.sendMessage`. Devuelve el mensaje enviado.
- `false`: envía un mensaje interactivo con pie `@<name>` con `relayMessage`. ⚠️ Devuelve el ID, no un objeto con `key`.
- Si pasas un objeto con builders (sin `text`), siempre usa `sock.sendMessage`.

## `m.quoted.chat` · 1.1 y `m.quoted.sender` · 1.2 ✅

Solo existen si el mensaje cita a otro.

```js
m.quoted.chat    // { id, isGroup, metaData(), size, desc, name, created, participants, owner, admins }
m.quoted.sender  // { id, number, user, isAdmin }
```

⚠️ `m.quoted.chat.metaData()` usa `m.sock`, que solo existe en sub-bots. En el bot principal, usa `sock.groupMetadata(id)`.

## Parseo de comando · `Infinity`

`m.body`, `m.tag`, `m.args`, `m.text`, `m.command`, `m.isCmd`, `m.plugin`. Ver [Plugins](plugins.md#qué-recibe-m-al-llegar-aquí).
