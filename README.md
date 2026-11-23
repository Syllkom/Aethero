# Aethero

Framework modular y orientado a eventos para bots de WhatsApp sobre [Baileys](https://github.com/WhiskeySockets/Baileys).

- **Aislamiento de procesos:** el bot corre en un proceso hijo supervisado; si se corrompe, se reinicia solo.
- **Hot-reload:** plugins, handlers, scrapers y builders se recargan al guardar el archivo, sin reiniciar ni reconectar.
- **Pipeline por prioridad:** cada mensaje atraviesa una cadena de handlers que enriquecen el objeto `m`.
- **Sub-bots:** sesiones adicionales de WhatsApp aisladas en workers.

## Inicio rápido

Requisitos: **Node.js ≥ 22.5** (usa `node:sqlite`) y, para stickers/video, ffmpeg (se instala `ffmpeg-static` como opcional).

```bash
git clone -b framework https://github.com/Syllkom/Aethero.git
cd Aethero
npm install
npm start
```

En el primer arranque eliges vincular por **QR** o por **código de 8 dígitos**. Después crea tu primer comando:

```js
// plugins/general/ping.plugin.js
export default {
    command: true,
    case: 'ping',
    script: async (m) => { await m.reply('pong') }
}
```

Guárdalo y escribe `.ping` en WhatsApp. No hace falta reiniciar.

## Documentación

| Quiero… | Lee |
|---|---|
| Instalar y ejecutar por primera vez | [Primeros pasos](docs/getting-started.md) |
| Entender cómo funciona por dentro | [Arquitectura](docs/architecture.md) |
| Escribir comandos, middlewares, eventos de grupo o reacciones | [Plugins](docs/plugins.md) |
| Saber qué trae el objeto `m` | [Objeto de mensaje](docs/message-object.md) |
| Añadir pasos al pipeline | [Handlers](docs/handlers.md) |
| Enviar botones, catálogos, stickers, álbumes… | [API del socket](docs/socket-api.md) · [Builders](docs/builders-reference.md) |
| Esperar la respuesta de un usuario | [Flujos de respuesta](docs/reply-flows.md) |
| Configurar el bot | [Configuración](docs/configuration.md) |
| Saber dónde se guardan los datos | [Almacenamiento y sesión](docs/storage-and-auth.md) |
| Ejecutar varios números | [Sub-bots](docs/subbots.md) |
| Resolver un problema | [Solución de problemas](docs/troubleshooting.md) |

## Estructura

```
index.js        Proceso padre: define qué carpetas se registran (MODULEREGISTRY)
config.js       Configuración global
core/           Motor (supervisor, conexión, registro de módulos, auth, IPC de sub-bots)
handlers/       Pipeline de mensajes (orden por priority)
plugins/        Tus comandos (vacía en la rama framework)
library/        Extensiones del socket, builders, medios, scrapers
storage/        Sesión, base de datos y temporales (se crea sola; no se versiona)
```

## Licencia y créditos

MIT. Autor: Orwyth ([Syllkom](https://github.com/Syllkom)). El motor IPC de sub-bots parte de `baileys-ipc` de [Zeppth](https://github.com/Zeppth).
