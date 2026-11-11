# Aethero Full Experience

Bienvenido a **Aethero**, la versión completa y definitiva del framework. Esta rama contiene absolutamente todo: el núcleo modular, el motor de sub-bots, herramientas de administración, descargas, y la experiencia completa de RPG y Gacha.

Si buscas un bot de WhatsApp listo para usar, con economía, juegos, waifus y todas las herramientas, has llegado al lugar correcto.

## Características Principales
- **Sistema Gacha & RPG:** Reclama personajes, sube de nivel, trabaja, roba y gestiona tu inventario.
- **Juegos Integrados:** Tic-Tac-Toe, Dino, y más.
- **Descargas Multi-Plataforma:** YouTube, TikTok, Facebook, Appteka, etc.
- **Administración de Grupos:** Herramientas avanzadas para moderar (kick, ban, antilink).
- **Herramientas de Owner:** Shell interactivo, edición/borrado invisible (dmsg, edit), envío de tareas Meta AI (rich) y control de sub-bots.

## Instalación Rápida
1. Clona esta rama:
   git clone -b main https://github.com/Syllkom/Aethero.git
2. Entra al directorio:
   cd Aethero
3. Instala las dependencias:
   npm install
4. Configura tus datos en `config.js` (dueños, prefijos, etc.).
5. Inicia el bot:
   npm start

## Aviso Importante
Esta rama incluye plugins de "Owner" que interactúan directamente con el protocolo de WhatsApp de formas no oficiales (ej. borrar mensajes ajenos, bucles de edición en Meta AI). El uso excesivo de estos comandos puede resultar en la suspensión de tu cuenta. Úsalos con responsabilidad.

## Otras Versiones de Aethero
- **Rama Essentials:** Bot funcional básico sin RPG ni juegos pesados (ideal para producción).
- **Rama Framework:** Código base limpio sin plugins para desarrolladores que quieran crear sus propios módulos.

## Créditos
- **Framework & Plugins:** Syllkom (Orwyth)
- **Motor IPC:** Zeppth (Creador original) + Syllkom (Fork)
