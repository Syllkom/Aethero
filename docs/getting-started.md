# Primeros pasos

## Requisitos

| Requisito | Detalle |
|---|---|
| Node.js | **≥ 22.5**. La sesión de WhatsApp se guarda con `node:sqlite` ✅. ⚠️ Antes de la 22.13 ese módulo exige `--experimental-sqlite`, y Aethero no pasa esa bandera al proceso hijo: usa **22.13 o superior**. |
| Sistema | Linux (x64/ARM64), macOS, Windows y Android (Termux). |
| ffmpeg | Necesario para stickers animados y conversión de video. Se instala `ffmpeg-static` como dependencia opcional; si falla, instala ffmpeg del sistema. |
| Git | Las dependencias `@syllkom/hyper-db` y `baileys-ipc` se descargan desde GitHub. |

## Instalación

```bash
git clone -b framework https://github.com/Syllkom/Aethero.git
cd Aethero
npm install
```

Crea un `.env` solo si lo necesitas (todas las claves son opcionales):

```env
GOOGLE_API_KEY=
DANBOORU_LOGIN=
DANBOORU_API_KEY=
```

## Primer arranque

```bash
npm start
```

1. Se muestra el resumen del sistema (estilo neofetch).
2. Si **no existe** una sesión previa, aparece el menú de vinculación:
   - **1. Código QR**: escanéalo desde WhatsApp → Dispositivos vinculados.
   - **2. Código de 8 dígitos**: escribe el número del bot con código de país, sin `+` (ej. `51999999999`) e ingresa el código que aparece en consola.
3. Al conectar verás `Connection open`. Los siguientes arranques reutilizan la sesión y no preguntan nada.

La sesión vive en `storage/creds/main/session.sqlite`. Para vincular otro número, borra `storage/creds` con el bot detenido.

## Tu primer comando

La rama `framework` no incluye plugins. Crea `plugins/general/ping.plugin.js`:

```js
export default {
    command: true,          // obligatorio: sin esto no se trata como comando
    case: ['ping', 'p'],    // alias
    description: 'Comprueba que el bot responde.',
    script: async (m, { sock }) => {
        await m.reply('pong')
    }
}
```

Con el bot en marcha, el archivo se detecta solo en menos de un segundo (no se imprime ningún aviso). Envía `.ping` desde WhatsApp.

- El archivo debe terminar en **`.plugin.js`**; cualquier otro nombre se ignora como comando.
- Si lo editas, se recarga sin reiniciar.
- Los prefijos válidos están en `global.config.prefixes` (por defecto `.¿?¡!#%&/,~@`).

## Dos formas de responder

`global.config.humanizer` cambia cómo responde `m.reply` con texto:

| Valor | Resultado |
|---|---|
| `true` | Mensaje de texto normal, precedido de "escribiendo…" simulado. |
| `false` (por defecto en `config.js`) | Mensaje interactivo con pie `@Aethero`, enviado por `relayMessage`. |

⚠️ En modo interactivo `m.reply` devuelve el **ID** del mensaje, no el objeto con `key`. Si necesitas la `key` (editar el mensaje, [flujos de respuesta](reply-flows.md)), envía con `sock.sendMessage(m.chat.id, { text }, { quoted: m.raw })`.

## Siguientes pasos

- [Plugins](plugins.md): comandos, middlewares, eventos de grupo y reacciones.
- [Configuración](configuration.md): qué hace cada opción de `config.js`.
- [Solución de problemas](troubleshooting.md).
