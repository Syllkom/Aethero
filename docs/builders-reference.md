# Referencia de builders

> **Estado: migrado del README anterior (secciones 6.0–6.16), pendiente de verificar contra el código.** La lista de claves que `sock.sendMessage` reconoce SÍ está verificada en [socket-api.md](socket-api.md). Los nombres de archivo de esta página usaban el formato antiguo (`interactive.builder.js`); hoy son `library/builders/*.builder.js`.

## Builders y extensiones del socket

Todas las extensiones descritas en esta sección se inyectan sobre el objeto `sock` de Baileys en `library/socket.extensions.js`, ejecutado una vez en `core/main.js` justo después de que la conexión abre: `await socketExtensions(sock)`. A partir de ahí, `sock.sendMessage(jid, content, options)` reconoce automáticamente un conjunto de claves especiales en `content` y despacha al *builder* correspondiente — **no es necesario llamar a los builders directamente**, basta con usar `sock.sendMessage` normalmente.

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

No solicitado explícitamente en el listado inicial de builders, pero presente y funcional en `interactive.builder.js`. Genera un `pollResultSnapshotMessage` (tarjeta de resultados de encuesta, sin ser una encuesta interactiva real):

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


### 6.10.1 Mensajes de Comercio Directos (`commerce.builder.js`)

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

### 6.11. Contextos Falsos (`fakeContext.builder.js`)

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



### 6.14. Suite Interactiva Meta AI / GenAI (`sock.AIRich`)

`sock.AIRich` es un constructor fluido que permite generar mensajes nativos de **Meta AI / GenAI** (`botForwardedMessage` + `richResponseMessage`). Incluye omisión automática de advertencias de seguridad mediante generación de certificados criptográficos (`verificationMetadata`), resaltado de sintaxis, carruseles sociales y renderizado de aplicaciones Webview HTML completas.

#### A. Inicialización y Envío Básico
```javascript
const rich = new sock.AIRich()
    .setTitle('Aethero AI Engine')
    .addBanner('https://i.ibb.co/banner.jpg')
    .addText('*Analisis de Datos*\n- Estado: Completado\n=={Texto resaltado en amarillo}==')
    .setFooter('Aethero Engine')

await rich.send(m.chat.id)
```

#### B. Catálogo de Métodos y Primitivas

| Método | Primitiva Protocolo | Parámetros y Descripción |
|---|---|---|
| `addBanner(url, opts)` | `GenAIImagePrimitive` | Renderiza una imagen de cabecera limpia de borde a borde sin barras de carga. |
| `addProgressStatus(title, opts)` | `GenAIBotProgressStatusPrimitive` | Barra de estado con efecto de brillo/progreso (`isInProgress: true/false`). |
| `addText(text, opts)` | `GenAIMarkdownTextUXPrimitive` | Texto con formato Markdown, resaltado `=={texto}==` y enlaces `[Texto](url)` o `[Texto](!url)`. |
| `addHtml(html, opts)` | `GenAIaeacdsnwHtmlPrimitive` | Ejecuta aplicaciones y juegos interactivos en HTML/CSS/JS con Web Audio API y Canvas dentro del chat. |
| `addCode(lang, code, opts)` | `GenAICodeUXPrimitive` | Bloque de código con tokenizador y resaltado sintáctico automático para JS, TS, Python, Java, C++, Rust, etc. |
| `addTable(array, opts)` | `GenAITableUXPrimitive` | Tabla estructurada a partir de un arreglo bidimensional `[['Cabecera 1', 'Cabecera 2'], ['Dato 1', 'Dato 2']]`. |
| `addCitations(text, list, opts)` | `GenAISearchCitationItem` | Texto con píldoras de citas interactivas `{{IE_CITE_0}}[1]{{/IE_CITE_0}}` y fuentes vinculadas. |
| `addSource(sources, opts)` | `GenAISearchResultPrimitive` | Tarjetas de resultados de búsqueda con favicons y enlaces de referencia ("Ver detalles"). |
| `addSingleProduct(product, opts)` | `GenAIProductItemCardPrimitive` | Tarjeta de producto individual horizontal con imagen, precio actual y precio original tachado. |
| `addProduct(array, opts)` | `GenAIProductItemCardPrimitive` | Carrusel horizontal (`HScroll`) de productos comerciales. |
| `addSocialCards(cards, opts)` | `GenAIPostPrimitive` | Carrusel deslizable de publicaciones para Pinterest, Instagram o TikTok con insignias oficiales. |
| `addReels(reels, opts)` | `GenAIReelPrimitive` | Carrusel deslizable de Reels de video con avatar, contador de likes y reproductor. |
| `addSystemWidgets(widgets, opts)` | `GenAI3PExtWidgetPrimitive` | Cuadrícula de widgets con botones de acción y comandos rápidos (`.menu`, `.play`, etc.). |
| `addImageButton(logo, opts)` | `GenAIActionRowLayoutViewModel` | Fila interactiva con botón central de enlace (`OPEN_URL`) y logotipos circulares en LaTeX `[Logo 1] [Boton] [Logo 2]`. |
| `addCompactEntity(entities, opts)` | `GenAICompactEntityPrimitive` | Tarjetas de acción directa para unirse a grupos (`GROUP`), seguir personas (`PERSON`) o agendar eventos. |
| `addSuggest(array, opts)` | `GenAIFollowUpSuggestionPillPrimitive` | Fila de sugerencias interactivas tipo píldora. |
| `addTip(text, opts)` | `GenAIMetadataTextPrimitive` | Caja de consejo informativa con prefijo de sistema. |
| `addFOAText(text, opts)` | `FOATextPrimitive` | Texto en formato de anuncio/FOA. |

#### C. Edición Progresiva en Vivo (Live Streaming)
`AIRich` permite enviar un mensaje y editarlo progresivamente en tiempo real mediante `protocolMessage` tipo 14 sin enviar mensajes nuevos ni emitir notificaciones sonoras molestas:

```javascript
const rich = new sock.AIRich()
    .setTitle('Aethero Stream')
    .addProgressStatus('FASE 1: PROCESANDO...', { id: 'status', isInProgress: true })
    .addText('Iniciando inferencia...', { id: 'content' })

await rich.send(m.chat.id)

await new Promise(r => setTimeout(r, 1500))

rich.addProgressStatus('FASE 2: GENERANDO CODIGO...', { replace: 'status', isInProgress: true })
rich.addCode('javascript', 'const test = true', { id: 'code_block' })
await rich.sendEdit()

await new Promise(r => setTimeout(r, 2000))

rich.addProgressStatus('COMPLETADO', { replace: 'status', isInProgress: false })
rich.addSuggest(['.menu', '.ping'])
await rich.sendEdit()
```

### 6.16. Creador de Sticker Packs Oficiales (`content.stickerPack`)

Permite empaquetar conjuntos de stickers WebP / Lottie en un archivo `.zip` con compresión `STORE`, generar miniaturas e íconos de bandeja (`tray_icon.webp` y JPEG de 252×252 píxeles mediante Jimp) y subirlos directamente a los servidores MMS de WhatsApp (`/mms/sticker-pack`) despachando un `stickerPackMessage` nativo.

```javascript
await sock.sendMessage(m.chat.id, {
    stickerPack: {
        name: 'Aethero Pack Oficial',
        publisher: 'Orwyth',
        description: 'Pack de stickers interactivos',
        stickers: [
            bufferSticker1,
            'https://ejemplo.com/sticker2.webp',
            { buffer: bufferSticker3, isAnimated: true }
        ]
    }
}, { quoted: m.raw })
```

---

