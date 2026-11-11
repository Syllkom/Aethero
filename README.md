# Aethero Essentials

Bienvenido a **Aethero Essentials**, la versión lista para usar de Aethero Framework. 

Esta rama contiene el núcleo del framework junto con los plugins esenciales para administrar grupos, descargar multimedia y gestionar el bot, sin el peso de los módulos RPG o Gacha.

> ⚠️ **ADVERTENCIA IMPORTANTE:** Esta versión incluye plugins de "Owner" que explotan vulnerabilidades del protocolo de WhatsApp (como borrar mensajes ajenos o forzar tareas en Meta AI). Por favor, lee el archivo [Advertencias de Uso](docs/03-warnings.md) antes de usarlos para evitar el baneo de tu cuenta.

## Requisitos
- Node.js >= 22.5.0 (Necesario para `node:sqlite` nativo).
- FFmpeg instalado en el sistema (para conversión de media).
- Un número de WhatsApp para vincular.

## Instalación Rápida
1. Clona esta rama:
   `git clone -b essentials https://github.com/Syllkom/Aethero.git`
2. Entra al directorio:
   `cd Aethero`
3. Instala las dependencias:
   `npm install`
4. Configura tus datos en `config.js` (nombre del bot, prefijos, owners).
5. Inicia el bot:
   `npm start`

## ¿Qué incluye esta versión?
- **Gestión de grupos:** Herramientas de administración (kick, promote, welcome, antilink).
- **Descargas:** Soporte para TikTok, YouTube, Facebook, entre otros.
- **Herramientas (Tools):** Stickers, creador de stickers reactivos, revelador de ViewOnce, etc.
- **Owner/Main:** Control de Sub-bots, comandos de owner, menús y estadísticas.

## Documentación
- [Guía de Instalación y Configuración](docs/01-setup.md)
- [Catálogo de Comandos](docs/02-commands.md)
- [Advertencias de Uso (¡Leer antes de usar plugins de Owner!)](docs/03-warnings.md)

Para desarrolladores que deseen crear sus propios plugins desde cero o modificar el núcleo, revisa la rama `framework` donde se encuentra la documentación técnica profunda.

## Créditos
- **Framework:** Syllkom (Orwyth)
- **Motor IPC:** Zeppth (Creador original) + Syllkom (Fork)
