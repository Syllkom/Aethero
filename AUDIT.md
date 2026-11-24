# Qué cambió respecto al README anterior

Contraste del README viejo (95 KB) con el código de la rama `framework` (commit `f28d974`). Para revisar y descartar.

## Datos incorrectos que se corrigieron

| README anterior | Realidad en el código |
|---|---|
| La base de datos es **LMDB** (secciones 2, 4.3, 9.2) | HyperDB es "Zero-Native" y **no** usa LMDB (README de `hyper-db`). El propio README decía "V8 Atomic Engine" en la cabecera. |
| `hyperDBAuth.js` guarda un único `session.json` (árbol de directorios) | Usa `node:sqlite` (`session.sqlite`); `session.json` solo se migra. |
| `alwaysOnline: true`, `antiCall: false` | `alwaysOnline: false`, `antiCall: true`. |
| No menciona `humanizer` | Controla si `m.reply` es texto normal o mensaje interactivo. |
| Retraso de escritura `min(len*30, 3000)+rand(500)` | `min(len*25, 2500)+rand(300)`, y solo con `humanizer` activo. |
| Archivos `socketExtensions.js`, `commerceBuilder.js`, `fakeContextBuilder.js`, `interactiveBuilder.js` | `socket.extensions.js`, `commerce.builder.js`, `fakeContext.builder.js`, `interactive.builder.js` (más `aiRich`, `richLink`, `stickerPack`). |
| Node `>= 22.5.0` (README) y `>=18` (`package.json`) | Se contradicen. Con `node:sqlite` hace falta ≥ 22.5, y sin bandera ≥ 22.13. |
| La reconexión ocurre dentro de `waClient.js` (`StartBot({...})`) | `waClient` emite `restart` y `main.js` llama a `mainBot.restart()`. |
| Ejemplo de encuesta con `state.yes++` | `state` es una copia por ejecución (`lodash.cloneDeep`); el conteo no persistía. |
| `ping` con `{ edit: sent.key }` y `setReplyHandler(sent)` | Con `humanizer: false`, `m.reply` devuelve un ID, no un objeto con `key`. |

## Cosas que existían y no estaban documentadas

- Handler `m.reaction.handler.js` (0.13).
- Plugins de reacción (`reaction`, `dbScope`, `dbName`).
- Sub-bots (`global.subbots`, `spawnSubbot`, `baileys-ipc`, base por sub-bot).
- `sock.getJSON`, `sock.resizePhoto`, `sock.loadMessage`, `sock.updateProfilePicture`, `richLink`, `pairedMedia`, `aiRich`.
- `config.iconAI`, `config.humanizer`.
- Caché de metadatos de grupo de 5 minutos y respaldo en `@chat:<id>.savedMetadata`.

## Hallazgos de código (no son errores de documentación)

Documentados como ⚠️ en las guías; conviene decidir si se arreglan:

1. ~~`m.viewonce.cache.js` no terminaba en `.handler.js`~~ (subido por error; ya eliminado del repo).
2. `antiCallWhitelist: [""]` deja pasar a todos los llamantes.
3. Los plugins de reacción corren antes de que exista `m.reply`.
4. Editar builders o `socket.extensions.js` no tiene efecto sin reiniciar.
5. El hot-reload acumula módulos en memoria; `inspectPlugins` reimporta todo en cada llamada.
6. El padre relanza el hijo sin límite ni espera creciente.
7. `config.js` inicializa HyperDB también en el proceso padre.
8. Los errores al guardar la sesión se silencian.

## Sin verificar contra el código

- `docs/builders-reference.md` (secciones 6.0–6.16 del README anterior, migradas tal cual salvo nombres de archivo). Las claves de `sendMessage` sí están verificadas en `socket-api.md`.
- Internos de `baileys-ipc` y de `hyper-db` más allá de lo que usa Aethero.
- Payload de emparejamiento por pin de los sub-bots.

## Actualización: nuevos riches

- `library/builders/aiRich.builder.js`: añadidos `addSteps` y `addStepsProgress`; `addProgressStatus` acepta `icon` (por defecto `null`, sin cambio de comportamiento). Documentados en `docs/builders-reference.md`, sección D.
- `addBottomSheet` y `addFullScreenApp` existen en el código y siguen sin documentarse.
- `library/builders/audioSticker.builder.js` (nuevo) y su rama en `sendMessage` (`content.audioSticker`). Documentado en `docs/builders-reference.md`, sección 6.17.

### Pruebas realizadas al builder de sticker con audio (offline, con subida simulada)

- Conversión real con ffmpeg: MP3 → Ogg/Opus y JPG → WebP 512×512.
- El mensaje codificado contiene el campo `134`; al decodificarlo, `StickerMessage` (512×512, `image/webp`) y `AudioMessage` (`audio/ogg; codecs=opus`) recuperan sus rutas, tamaños y claves de 32 bytes, y ambos conservan el sub-campo `17`.
- El campo `134` sobrevive cuando el mensaje va anidado en `deviceSentMessage` (envío a los dispositivos propios).
- Dos construcciones en paralelo funcionan; un mensaje normal se codifica idéntico antes y después del parche.
- **No probado:** entrega y renderizado reales en WhatsApp.
- El builder envía **WebP animados sin reconvertir** (se sube el mismo archivo, `isAnimated: true`). Verificado offline: el tamaño subido coincide con el original cifrado. **No probado en WhatsApp:** cómo se muestra un sticker animado con audio.
