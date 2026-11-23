# Plugins

Un plugin es un archivo `*.plugin.js` dentro de `plugins/` (en cualquier subcarpeta) que exporta por defecto un objeto. Se carga, recarga y elimina en caliente. Hay cuatro tipos, según la propiedad que lo activa:

| Tipo | Se activa con | Se ejecuta cuando… |
|---|---|---|
| Comando | `command: true` | El mensaje empieza por uno de sus `case`. |
| Middleware | `before: true` | **Cada** mensaje, antes de resolver comandos. |
| Evento de grupo | `stubtype: true` | Llega un evento de sistema (alguien entra, cambia el nombre…). |
| Reacción | `reaction: '<emoji>'` o `'*'` | Alguien reacciona a un mensaje. |

Valores que el registro aplica por defecto: `usePrefix: true`, `stubtype: false`, `command: false`. Por eso **`command: true` es obligatorio** para un comando ✅.

## Comando

```js
// plugins/general/ping.plugin.js
export default {
    command: true,
    usePrefix: true,                // true: ".ping"; false: "ping" sin prefijo
    case: ['ping', 'p'],            // string o array
    description: 'Comprueba que el bot responde.',
    category: 'general',            // opcional, para menús
    usage: ['ping'],                // opcional, para menús
    script: async (m, { sock, plugins, scrapers, modules }) => {
        await m.reply('pong')
    }
}
```

| Campo | Tipo | Uso |
|---|---|---|
| `command` | `boolean` | Obligatorio en `true`. |
| `case` | `string \| string[]` | Alias. Se compara en minúsculas con `m.command`. |
| `usePrefix` | `boolean` | Con prefijo (`true`) o sin él (`false`). Un mismo plugin no responde a ambos. |
| `description`, `category`, `usage` | | Metadatos para menús de ayuda ([pluginInspector](#menús-de-ayuda)). |
| `list` | `array` | Varios subcomandos en un archivo: `[{ category, usage }]`. |
| `script` | `function` | `(m, ctx) => any`. |

`ctx` contiene: `sock`, `modules`, `plugin` / `plugins` (carpeta de plugins) y `scraper` / `scrapers` (carpeta de scrapers). Los pares son alias de lo mismo.

### Qué recibe `m` al llegar aquí

Todo lo descrito en [Objeto de mensaje](message-object.md), más el resultado del parseo:

| Propiedad | Ejemplo con `.ping hola mundo tag=vip` |
|---|---|
| `m.body` | `.ping hola mundo` (sin los `tag=`) |
| `m.command` | `ping` |
| `m.args` | `['hola', 'mundo']` |
| `m.text` | `hola mundo` |
| `m.tag` | `['vip']` |
| `m.isCmd`, `m.plugin` | `true` y el plugin encontrado |

Los tokens `tag=valor` se extraen del texto antes de calcular `args` y `text`.

### Permisos: patrón habitual

```js
script: async (m) => {
    if (!m.chat.isGroup)               return m.sms('group')
    if (!m.sender.isAdmin)             return m.sms('admin')
    if (!m.bot.isAdmin)                return m.sms('botAdmin')
    if (!m.sender.role('root', 'owner')) return m.sms('owner')
    // ...
}
```

`m.sender.role(...)` es `true` si **cualquiera** de los roles listados está activo.

### Errores

Si `script` lanza un error, se registra en consola (`Plugin Execution Error`) y no se avisa al usuario. Los errores de conexión cerrada (428 / "Connection Closed" / "Precondition Required") se **relanzan** para que el framework reinicie el proceso. Captura tus errores si quieres responder algo.

## Middleware (`before`)

```js
// plugins/middleware/antilink.plugin.js
export default {
    before: true,
    priority: 1,                    // menor = antes; sin priority va al final
    script: async (m, { sock, control }) => {
        if (!m.chat.isGroup || m.sender.isAdmin) return
        if (!/chat\.whatsapp\.com\/\w+/i.test(m.content.text)) return
        if (!m.bot.isAdmin) return

        await sock.sendMessage(m.chat.id, { delete: m.raw.key })
        control.end = true          // corta el pipeline: no se interpretará como comando
    }
}
```

Se ejecutan en el handler de prioridad 1.8. Recibes `{ sock, control, modules }`.

## Evento de grupo (`stubtype`)

```js
// plugins/events/welcome.plugin.js
export default {
    stubtype: true,
    case: ['GROUP_PARTICIPANT_ADD'],     // nombre del enum proto.WebMessageInfo.StubType
    script: async (m, { sock, parameters }) => {
        for (const jid of parameters) {
            await sock.sendMessage(m.chat.id, {
                text: `Bienvenido @${jid.split('@')[0]}`,
                mentions: [jid]
            })
        }
    }
}
```

Contexto recibido ✅: `{ sock, control, parameters, even, modules }`. ⚠️ El nombre del evento llega como **`even`** (sin la "t"). `parameters` son los `messageStubParameters` ya parseados como JSON cuando es posible.

## Reacción

```js
// plugins/fun/estrella.plugin.js
export default {
    reaction: '⭐',                  // o '*' para cualquier emoji
    dbScope: 'user',                // 'global' → una base compartida; otro valor → una por usuario
    dbName: '@estrellas',           // por defecto '@plugins_db'
    script: async (m, { sock, targetKey, emoji, userKey, db }) => {
        db.count = (db.count || 0) + 1
        await sock.sendMessage(m.chat.id, { text: `Llevas ${db.count} ⭐` })
    }
}
```

- Contexto ✅: `{ sock, control, modules, targetKey, emoji, userKey, db }`. `targetKey` es la `key` del mensaje reaccionado.
- Se ignoran las reacciones del propio sistema (`⌛ ✔️ ✖️ ✅ ❌`).
- Tras ejecutarse, el pipeline termina (`control.end = true`).
- ⚠️ El handler de reacciones tiene prioridad `0.13` y `m.reply` / `m.react` se añaden en `0.15`, así que **dentro de un plugin de reacción aún no existen**. Responde con `sock.sendMessage`.

## Scrapers

Archivos `*.scraper.js` en `library/scrapers/` (ignorada por git en la rama `framework`). Hay dos formas de exportar y cada una se consume distinto ✅:

**A. Exports nombrados** → `scrapers.file(ruta)`

```js
// library/scrapers/tools/danbooru.scraper.js
export async function getPost(id) { /* ... */ }
```
```js
const danbooru = scrapers.file('tools/danbooru.scraper.js')
const post = await danbooru?.getPost(123)
```

**B. `export default { export: { ... } }`** → `scrapers.import('nombre')`

```js
// library/scrapers/tools/frases.scraper.js
async function fetchQuote() { /* ... */ }
export default { export: { fetchQuote } }
```
```js
const fetchQuote = scrapers.import('fetchQuote')
```

`import()` solo busca en lo declarado bajo `export`; un scraper con exports nombrados no aparece ahí.

## Otras extensiones

- `library/*.extensions.js` y `library/builders/*.builder.js` están registrados, pero ⚠️ no se recargan en caliente de forma efectiva (ver [Arquitectura](architecture.md#límites-del-hot-reload)). Las extensiones del socket reales viven en `library/socket.extensions.js`.

## Menús de ayuda

`library/pluginInspector.js` genera listados a partir de los metadatos:

```js
import { inspectPlugins, listCategoryUsage, countTotalCommands } from '../../library/pluginInspector.js'

const { items } = await inspectPlugins(path.resolve('./plugins'))
const texto = listCategoryUsage(items, { category: 'general' })
```

⚠️ `inspectPlugins` **vuelve a importar todos los plugins** en cada llamada (con `?update=`), lo que consume memoria. No la invoques en cada mensaje; cachea el resultado.
