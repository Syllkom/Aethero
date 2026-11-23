# Handlers

Un handler es un paso del pipeline. Todos los mensajes pasan por los handlers habilitados, ordenados por `priority` ascendente, hasta que uno ponga `control.end = true` ✅.

## Handlers incluidos

| `priority` | Archivo | Qué hace |
|---|---|---|
| `0.02` | `m.content.handler.js` | Añade `m.content` (y `m.quoted.content`). |
| `0.05` | `m.chat.handler.js` | Añade `m.chat` y sus acciones. Carga metadatos del grupo (caché de 5 min). |
| `0.10` | `m.bot.handler.js` | Añade `m.bot`. |
| `0.12` | `m.sender.handler.js` | Añade `m.sender` y sincroniza roles. |
| `0.13` | `m.reaction.handler.js` | Ejecuta [plugins de reacción](plugins.md#reacción) y corta el pipeline. |
| `0.15` | `m.assign.handler.js` | Añade `m.reply`, `m.react`, `m.sms`, `m.db`, `m.setBan`, `m.setRole`, `m.getQuotedText`, `m.getQuotedMedia`. |
| `1.1` | `quoted.chat.handler.js` | Añade `m.quoted.chat`. |
| `1.2` | `quoted.sender.handler.js` | Añade `m.quoted.sender`. |
| `1.5` | `m.pre.parser.handler.js` | Ejecuta [flujos de respuesta](reply-flows.md). |
| `1.8` | `func.before.handler.js` | Ejecuta plugins `before: true`. |
| `1.9` | `func.stubtype.handler.js` | Ejecuta plugins `stubtype: true`. |
| `2.21` | `func.log.handler.js` | Imprime el mensaje en consola (si `silentConsole` es `false`). |
| `Infinity` | `func.plugins.handler.js` | Parsea el comando y ejecuta el plugin. |

Orden de disponibilidad: lo que añade un handler solo existe para los de **mayor** prioridad. Ejemplo: `m.reply` (0.15) no existe aún en `m.reaction.handler.js` (0.13).

## Escribir un handler

Crea `handlers/mi-paso.handler.js`:

```js
export default {
    enabled: true,
    priority: 1.6,                   // entre pre.parser (1.5) y before (1.8)
    script: async function ({ sock, control, modules }) {
        // `this` es `m`: por eso es `function`, no una función flecha
        const user = await this.sender.db()
        if (user.banned) control.end = true     // ignora a los usuarios baneados
    }
}
```

Reglas:

- **Debe ser `function`**, no flecha: el framework lo invoca con `.call(m, ...)`.
- El archivo termina en `.handler.js` y está en `handlers/`.
- `enabled: false` lo desactiva sin borrarlo.
- Sin `priority` se ejecuta al final (`Infinity`), junto al enrutador de plugins.
- Las excepciones se registran como `main.js` y **cortan el resto del pipeline de ese mensaje**; usa `try/catch` si tu paso es opcional.
- En sub-bots el handler recibe además `conn` (el mismo `sock`) y `m.sock`.

## Cortar el pipeline

```js
control.end = true
```

Lo usan los flujos de respuesta, las reacciones y los middlewares para que un mensaje no se interprete además como comando.
