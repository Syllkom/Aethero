# API del socket (`sock`)

`sock` es el socket de Baileys con las extensiones de `library/socket.extensions.js`, aplicadas al abrir la conexión ✅. Todo lo de Baileys sigue disponible; esto es lo que añade o cambia.

## `sock.sendMessage(jid, content, options)`

Reconoce claves especiales en `content` y las envía con su *builder*. Si no hay ninguna, envía el contenido normal de Baileys.

| Clave de `content` | Qué envía |
|---|---|
| `invoice`, `payment`, `order`, `catalog`, `productList` (o `listProducts`) | Mensajes de comercio. |
| `orderStatusMenu`, `mediaMenu`, `productMenu`, `interactiveMenu`, `locationMenu`, `cards`, `adMenu` | Menús interactivos. |
| `locationButtons` (o `buttonsMenu`) | Botones compactos con cabecera multimedia. |
| `album` | Varias imágenes/videos agrupados. |
| `pairedMedia` | Medios emparejados. |
| `pollSnapshot` | Estadísticas de encuesta. |
| `richLink` (o `linkPreview`) | Enlace enriquecido. |
| `stickerPack` | Paquete oficial de stickers. |
| `audioSticker` | ⚠️ Sticker con audio incrustado (experimental). |
| `aiRich` o una instancia de `sock.AIRich` | Mensajes estilo Meta AI. |

Detalle de cada builder en [Referencia de builders](builders-reference.md).

Comportamientos añadidos a **todos** los envíos:

- `options.quoted` acepta el objeto `m.quoted`/un mensaje con `.raw`; si no tiene `key`, se descarta.
- Se genera un `messageId` con prefijo `HK_` si no pasas uno.
- Con `config.iconAI` activo y destino privado, se añade el nodo `biz_bot`.
- El mensaje enviado se guarda en el historial (si `saveHistory`).

## `sock.relayMessage(jid, message, options)`

Igual que el de Baileys, pero asigna `messageId`, añade `biz_bot` si corresponde, guarda historial y devuelve `res || msgId` (un **ID**, no un objeto).

## Mensajes y medios

| Método | Descripción |
|---|---|
| `sock.sendSticker(jid, { sticker: Buffer \| { url }, mediaType }, quoted, options)` | Convierte imagen o video a WebP con EXIF y lo envía. `mediaType: 'video'` para animados. |
| `sock.sendStickerPack(jid, data, opts)` | Atajo de `content.stickerPack`. |
| `sock.downloadMedia(rawMessage, type = 'buffer')` | Descarga un medio; reintenta una vez si recibe 429. |
| `sock.loadMessage(jid, id)` | Recupera un mensaje del historial (`null` si `saveHistory` está apagado o no existe). |
| `sock.generateWMContent(obj)` / `sock.sendWAMContent(jid, content, options)` | Generan/envían contenido de bajo nivel con subida de medios. |

## Mensajes falsos (para citar)

`sock.fakeOrder`, `sock.fakeCatalog`, `sock.fakePayment`, `sock.fakeInvoice`, `sock.fakeLink`: devuelven un mensaje simulado que puedes usar como `quoted`.

```js
const q = await sock.fakeOrder(jid, { orderId: 'X1', itemCount: 3, message: 'Hola', orderTitle: 'Tienda', price: 10, currency: 'USD' })
await sock.sendMessage(jid, { text: 'Gracias' }, { quoted: q })
```

## Utilidades

| Método | Descripción |
|---|---|
| `sock.getBuffer(urlOBuffer)` | Descarga a `Buffer` (timeout 10 s). Si falla devuelve un `Buffer` vacío, no lanza. |
| `sock.getJSON(url)` | GET JSON con 2 reintentos. Si falla devuelve `0`. |
| `sock.resizePhoto({ image, scale = 140, result = 'buffer' \| 'base64', fit = 'cover' \| 'contain' })` | Redimensiona; si falla devuelve un PNG mínimo. |
| `sock.profilePictureUrl(jid, type)` | Con timeout de 4 s; si no hay foto o falla devuelve una imagen por defecto. |
| `sock.updateProfilePicture(jid, imagen)` | Acepta `Buffer`, URL o `{ url }`; redimensiona a 720 px. Para grupos, pasa el JID del grupo. |
| `sock.Baileys()` | Devuelve el módulo de Baileys. |
| `sock.setReplyHandler(...)` | Ver [Flujos de respuesta](reply-flows.md). |
| `sock.AIRich`, `sock.MessageToolkit` | Constructor y utilidades de mensajes Meta AI. |

## Propiedades añadidas

| Propiedad | Contenido |
|---|---|
| `sock.plugins` | Carpeta de plugins del registro. |
| `sock.modules` | El `ModuleRegistry` completo. |
| `sock.isSubbot` | `true` solo en sub-bots. |
