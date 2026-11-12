# Catalogo de Comandos (Essentials)

Este es el inventario de comandos disponibles en la version Essentials de Aethero. Todos utilizan los prefijos configurados (por defecto `.`).

## Downloader (Descargas)
- **.apk / .appteka** ‹nombre› : Busca y descarga aplicaciones desde la tienda Appteka.
- **.fb / .facebook** ‹url› : Descarga videos de Facebook en HD/SD.
- **.instagram / .ig** ‹url› : Descarga fotos, reels y carruseles de Instagram.
- **.tiktok** ‹url/busqueda› : Descarga videos de TikTok sin marca de agua o busca videos.
- **.ytmp3 / .ytmp4** ‹url/busqueda› : Descarga audio o video de YouTube.
- **.play** ‹busqueda› : Busca y reproduce (descarga) musica de YouTube.
- **.spotify** ‹url/busqueda› : Descarga canciones de Spotify.

## Group (Administracion de Grupos)
- **.kick / .expulsar** ‹@user› : Expulsa a un miembro del grupo.
- **.promote / .demote** ‹@user› : Otorga o retira privilegios de administrador.
- **.tagall / .todos** ‹texto› : Menciona a todos los miembros con un mensaje.
- **.hidetag / .notificar** ‹media/texto› : Notifica a todos de forma invisible.
- **.group / .abrir / .cerrar** : Abre o cierra la escritura del grupo.
- **.ghosts / .fantasmas** : Analiza la inactividad y elimina usuarios fantasmas.
- **.setpp** : Cambia la foto de perfil del grupo o del bot.
- **.rules** : Muestra o configura las reglas del grupo (genera imagen con Canvas).

## Main (Sistema y Configuracion)
- **.ping** : Verifica la latencia y el estado del bot.
- **.info** : Muestra estadisticas (RAM, CPU, Plugins cargados).
- **.menu** : Muestra el menu de comandos disponibles.
- **.creator** : Muestra la tarjeta de contacto del desarrollador.
- **.invite / .join** ‹link› : Solicita unir el bot a un grupo mediante link.
- **.report** : Envia un reporte de bug con media a los owners.
- **.settings** : Configuraciones generales del bot y del grupo.
- **.subbot** : Crea, lista o elimina sub-bots conectados.

## Tools (Herramientas)
- **.sticker / .s** : Convierte imagenes o videos a formato sticker.
- **.toimg** : Convierte un sticker estatico a imagen.
- **.tomp4 / .tovid** : Convierte un sticker a video, o fusiona imagen/video con un audio.
- **.tomp3** : Extrae el audio de un video y lo convierte a MP3.
- **.get / .fetch** ‹url› : Extrae el contenido de cualquier URL (detecta imagen, video, audio, html).
- **.tourl** : Sube un archivo multimedia a la nube y devuelve el enlace.
- **.whatmusic** : Identifica la cancion de un audio o video.
- **.whois / .stalk** : Muestra informacion tecnica y foto de perfil de un usuario.
- **.tr / .traducir** ‹idioma› ‹texto› : Traduce texto usando MyMemory API.
- **.sreact** : Stickers personalizados para reaccionar (usa `.sreact on/off`).
- **.vv / .velda** (o reaccionar con `💤`) : Revela mensajes de "Ver una vez" (Solo Owner).

## Owner (Comandos de Root)
- **.owner / .deowner** : Otorga o revoca permisos de owner.
- **.ban / .unban** : Bloquea o desbloquea usuarios del bot.
- **.botconfig** : Configura auto-lectura, anti-llamadas, etc.
- **.public / .private** : Alterna entre modo publico y privado.
- **.dmsg** ‹citar› : Elimina mensajes de otros sin ser admin (Bypass Protocol).
- **.edit** ‹texto› : Edita mensajes sin dejar rastro de "editado".
- **.dump** : Extrae el JSON crudo de un mensaje (util para debug).
- **.rich** : Genera tareas progresivas en vivo con Meta AI.
- **.> / .=> / .$** : Shell interactivo (ejecuta JS o comandos de consola).

## Events (Automatizaciones Silenciosas)
- **Eventos de Grupo:** El bot detectara y actuara automaticamente en eventos como cambios de administrador, cambios de foto de grupo, apertura/cierre de grupo, etc.
