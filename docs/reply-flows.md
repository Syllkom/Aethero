# Flujos de respuesta

Permiten esperar la respuesta de un usuario **citando** un mensaje concreto. El framework guarda el flujo en la base de datos y, cuando llega un mensaje que cita ese ID, ejecuta tu lógica antes de tratarlo como comando.

Piezas: `sock.setReplyHandler(...)` (registra) y el handler `m.pre.parser.handler.js` (prioridad 1.5, ejecuta).

## Registrar

```js
await sock.setReplyHandler(mensajeEnviado, opciones, expiraEnMs = 15 * 60 * 1000)
```

`mensajeEnviado` solo necesita `{ key: { id } }`. ⚠️ Con `humanizer: false`, `m.reply` devuelve el ID como texto; construye el objeto tú:

```js
const sent = await m.reply('¿Sí o no?')
const id = typeof sent === 'string' ? sent : sent?.key?.id
await sock.setReplyHandler({ key: { id } }, { /* opciones */ })
```

### Opciones

```js
{
    security: {
        userId: 'all' | '<jid>',            // quién puede responder
        chatId: 'all' | '<jid>',            // en qué chat
        scope:  'all' | 'private' | 'group'
    },
    lifecycle: { consumeOnce: true },       // borrar tras el primer éxito
    state: { /* datos tuyos */ },
    routes: [{
        priority: 1,                        // se evalúan de menor a mayor
        code: {
            guard:    (m, ctx) => boolean,  // true = SALTAR esta ruta
            executor: async (m, ctx) => any // si no devuelve false, cuenta como "manejado"
        }
    }]
}
```

`ctx` es `{ state, lifecycle, security, route, sock, modules }`. `createdAt` y `expiresAt` se calculan solos.

Si no coincide `security`, el mensaje se ignora en silencio y el flujo sigue vivo. Si el flujo expiró, se responde *"El tiempo límite para responder a este mensaje ha finalizado."* y se elimina.

## Reglas importantes ✅

1. **Las funciones se guardan como texto.** `guard` y `executor` pasan por `toString()` y se vuelven a crear con `eval()`. No pueden usar variables de fuera (closures) ni imports del plugin. Solo `m`, `ctx` y globales (`global`, `global.db`…).
2. Escríbelas como **funciones flecha o `function`**, no como método abreviado (`executor() {}` no se puede evaluar).
3. **`state` es una copia en cada ejecución.** El framework clona el flujo antes de ejecutarlo y no vuelve a guardar los cambios. Si quieres que persistan, escribe en la base (ejemplo abajo).
4. Todo lo guardado en `@reply:Handler` se ejecuta con `eval`. Protege `storage/` como protegerías tu código.

## Ejemplo: contador de votos que persiste

```js
// plugins/general/encuesta.plugin.js
export default {
    command: true,
    case: 'encuesta',
    script: async (m, { sock }) => {
        if (!m.text) return m.reply('Uso: .encuesta ¿Les gusta Aethero?')

        const sent = await m.reply(`📊 ${m.text}\n\nResponde citando con *sí* o *no*.`)
        const id = typeof sent === 'string' ? sent : sent?.key?.id

        await sock.setReplyHandler({ key: { id } }, {
            security: { scope: 'all', userId: 'all', chatId: m.chat.id },
            lifecycle: { consumeOnce: false },
            state: { yes: 0, no: 0 },
            routes: [{
                priority: 1,
                code: {
                    guard: (m) => !['si', 'sí', 'no'].includes((m.content.text || '').trim().toLowerCase()),
                    executor: async (m) => {
                        // Se lee y escribe en la base: `state` sería una copia descartable.
                        const store = await global.db.open('@reply:Handler')
                        const flujo = store[m.quoted.id]
                        const voto = m.content.text.trim().toLowerCase() === 'no' ? 'no' : 'yes'
                        flujo.state[voto]++
                        await m.reply(`✅ Voto registrado. Sí: ${flujo.state.yes} | No: ${flujo.state.no}`)
                        return true
                    }
                }
            }]
        }, 30 * 60 * 1000)
    }
}
```

## Qué pasa al responder

1. Llega un mensaje que cita el ID registrado.
2. `m.pre.parser` valida `security` y `lifecycle`.
3. Evalúa las rutas por `priority`; la primera cuyo `guard` no devuelva `true` ejecuta su `executor`.
4. Si el `executor` no devuelve `false`: `control.end = true` (no se interpreta como comando) y, con `consumeOnce`, se borra el flujo.
