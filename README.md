<p align="center">
  <img src="assets/banner.svg" alt="Aethero: framework modular para bots de WhatsApp" width="100%">
</p>

<p align="center">
  <a href="https://github.com/Syllkom/Aethero/stargazers"><img src="https://img.shields.io/github/stars/Syllkom/Aethero?style=flat-square&color=7c6cff" alt="Estrellas"></a>
  <a href="https://github.com/Syllkom/Aethero/commits/main"><img src="https://img.shields.io/github/last-commit/Syllkom/Aethero/main?style=flat-square&color=7c6cff" alt="Último commit"></a>
  <img src="https://img.shields.io/badge/node-%E2%89%A5%2022.13-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js 22.13 o superior">
  <img src="https://img.shields.io/badge/Baileys-WhatsApp-25D366?style=flat-square&logo=whatsapp&logoColor=white" alt="Baileys">
  <a href="LICENSE"><img src="https://img.shields.io/badge/licencia-MIT-blue?style=flat-square" alt="Licencia MIT"></a>
</p>

<p align="center">
  <a href="#características">Características</a> ·
  <a href="#qué-incluye">Qué incluye</a> ·
  <a href="#instalación">Instalación</a> ·
  <a href="#tu-primer-comando">Tu primer comando</a> ·
  <a href="#ramas">Ramas</a> ·
  <a href="#aviso-importante">Aviso</a>
</p>

<p align="center">
  Bot de WhatsApp <b>listo para usar</b> sobre un framework <b>modular y orientado a eventos</b>.<br>
  Economía, gacha, juegos, descargas, moderación de grupos y herramientas de owner, todo en una sola rama.
</p>

---

## Características

<table>
  <tr>
    <td width="33%" valign="top">
      <h4>🔥 Hot-reload</h4>
      Edita un plugin, un handler o un scraper y se aplica al guardar. Sin reiniciar y sin volver a conectar.
    </td>
    <td width="33%" valign="top">
      <h4>🛡️ Aislado y autorreparable</h4>
      El bot corre en un proceso hijo supervisado. Si algo se corrompe, se reinicia solo y tu sesión sigue en pie.
    </td>
    <td width="33%" valign="top">
      <h4>⛓️ Pipeline por prioridad</h4>
      Cada mensaje atraviesa una cadena de handlers que enriquecen el objeto <code>m</code> antes de llegar a tu comando.
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <h4>🤖 Sub-bots</h4>
      Ejecuta más números desde el mismo proceso, cada uno con su sesión y su base de datos, reutilizando todos tus plugins.
    </td>
    <td width="33%" valign="top">
      <h4>🎛️ Mensajes avanzados</h4>
      Builders para botones, catálogos, álbumes, mensajes tipo Meta AI y stickers con audio, sin tocar el protocolo a mano.
    </td>
    <td width="33%" valign="top">
      <h4>🗄️ Sin dependencias nativas</h4>
      Base de datos y sesión sin compilar nada en C++. Funciona en Linux, macOS, Windows y Android (Termux).
    </td>
  </tr>
</table>

## Qué incluye

Más de **80 plugins** organizados por carpeta dentro de `plugins/`:

| Categoría | Qué hace |
|---|---|
| **Descargas** | YouTube (audio y video), TikTok, Instagram, Facebook, Spotify y Appteka. |
| **Búsqueda** | Anime, Bing, letras, npm, Pinterest, Wikipedia y YouTube. |
| **Herramientas** | Stickers, conversión (imagen, video, mp3), subir a URL, traducción, reconocer música, sticker con audio y más. |
| **RPG** | Cuenta, aventuras, economía, tienda, ranking y relaciones. |
| **Gacha** | Tiradas, colección, intercambios y regalos. |
| **Juegos** | Tic-Tac-Toe, Dino y Block Blast. |
| **Grupos** | Expulsar, promover, mencionar a todos, reglas y foto del grupo. |
| **Seguridad y eventos** | Antilink, antibot, solo admins, bloqueo de chats privados y eventos de grupo. |
| **Divertidos** | Ship, reacciones y otros comandos para pasar el rato. |
| **Owner** | Shell interactivo, baneos, configuración del bot, borrado y edición de mensajes, mensajes *rich* y control de sub-bots. |

## Instalación

**Requisitos:** [Node.js](https://nodejs.org) **22.13 o superior**, `git` y `ffmpeg` (para stickers y audio).

```bash
git clone https://github.com/Syllkom/Aethero.git
cd Aethero
npm install
npm start
```

En el primer arranque eliges cómo vincular WhatsApp:

1. **Código QR**: escanéalo desde *Dispositivos vinculados*.
2. **Código de 8 dígitos**: escribe el número del bot con código de país y sin `+` (ejemplo: `51999999999`) e ingresa el código que aparece en consola.

Después ya no pregunta nada. Ajusta prefijos, dueños y demás opciones en [`config.js`](config.js).

<details>
<summary><b>Instalar en Android (Termux)</b></summary>

<br>

Usa Termux desde [F-Droid](https://f-droid.org/packages/com.termux/), no desde Play Store.

```bash
pkg update -y && pkg upgrade -y
pkg install -y git nodejs ffmpeg
node -v            # debe ser v22.13 o superior

git clone https://github.com/Syllkom/Aethero.git
cd Aethero
npm install
termux-wake-lock   # evita que Android lo apague con la pantalla bloqueada
npm start
```

Si alguna dependencia nativa da problemas, prueba la rama [`termux`](https://github.com/Syllkom/Aethero/tree/termux), adaptada a ese entorno.

</details>

<details>
<summary><b>Actualizar</b></summary>

<br>

Detén el bot (`Ctrl + C`) y ejecuta:

```bash
git pull
npm install   # solo si cambió package.json
npm start
```

Tu sesión y tus datos viven en `storage/`, que no se versiona, así que no se pierden.

</details>

## Tu primer comando

Crea `plugins/main/hola.plugin.js` con el bot encendido. Se detecta solo, sin reiniciar:

```js
export default {
    command: true,
    case: ['hola', 'hi'],
    description: 'Saluda al usuario.',
    script: async (m) => {
        await m.reply(`Hola, ${m.sender.name} 👋`)
    }
}
```

Escribe `.hola` en WhatsApp y listo. Para ir más allá (middlewares, eventos de grupo, reacciones, flujos de respuesta, builders), consulta la [documentación del framework](https://github.com/Syllkom/Aethero/tree/framework/docs).

## Ramas

| Rama | Para quién | Contenido |
|---|---|---|
| [`main`](https://github.com/Syllkom/Aethero/tree/main) | La mayoría | **Experiencia completa**: framework, RPG, gacha, juegos, descargas, moderación y herramientas de owner. |
| [`essentials`](https://github.com/Syllkom/Aethero/tree/essentials) | Producción | Bot funcional básico, sin RPG ni juegos pesados. |
| [`framework`](https://github.com/Syllkom/Aethero/tree/framework) | Desarrolladores | Código base limpio, sin plugins, más la documentación técnica. |
| [`termux`](https://github.com/Syllkom/Aethero/tree/termux) | Android | Adaptación para Termux (ARM64) y entornos sin dependencias nativas. |

## Estructura

```text
index.js        Proceso padre: supervisa y reinicia al hijo
config.js       Configuración global (prefijos, dueños, opciones)
core/           Motor: conexión, registro de módulos, sesión y sub-bots
handlers/       Pipeline de mensajes, ordenado por prioridad
plugins/        Tus comandos, middlewares y eventos, por categoría
library/        Extensiones del socket, builders, medios y scrapers
storage/        Sesión y base de datos (se crea sola, no se versiona)
```

## Aviso importante

> [!WARNING]
> Aethero no es un producto oficial de WhatsApp. Varios plugins de **owner** interactúan con el protocolo de formas no oficiales (por ejemplo, borrar mensajes ajenos o editar en bucle mensajes de Meta AI), y los *builders* envían mensajes con estructuras no estándar. El uso excesivo puede provocar la **suspensión de la cuenta**.
>
> Usa un **número secundario** y no compartas nunca la carpeta `storage/`: contiene tu sesión de WhatsApp.

## Contribuir

¿Encontraste un error o tienes una idea? Abre un [issue](https://github.com/Syllkom/Aethero/issues) o envía un pull request. Los plugins nuevos van en la categoría que corresponda dentro de `plugins/`.

## Créditos

- **Framework y plugins:** [Syllkom (Orwyth)](https://github.com/Syllkom)
- **Motor IPC de sub-bots:** [Zeppth](https://github.com/Zeppth), autor original de `baileys-ipc`, con el fork de Orwyth
- **Conexión a WhatsApp:** [Baileys](https://github.com/WhiskeySockets/Baileys)

## Licencia

Distribuido bajo licencia [MIT](LICENSE).

<p align="center"><sub>Desarrollado por Orwyth</sub></p>
