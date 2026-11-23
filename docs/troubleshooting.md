# Solución de problemas

## Mi plugin no responde

Revisa en orden:

1. El archivo termina en **`.plugin.js`** y está bajo `plugins/`.
2. Si el archivo tiene un error de sintaxis o de importación, se imprime `Error de importación (<ruta>)` en consola. Si no aparece nada, el sufijo o la carpeta son incorrectos (la recarga correcta **no** imprime aviso).
3. Tiene **`command: true`** y un `case`.
4. `usePrefix` coincide con cómo escribes: `.ping` necesita `usePrefix: true`; `ping` (sin prefijo) necesita `false`.
5. El prefijo que usas está en `global.config.prefixes`.

## `sock.setReplyHandler: key.id required`

`m.reply` devolvió un ID de texto (modo `humanizer: false`). Extrae el ID y pasa `{ key: { id } }`. Ver [Flujos de respuesta](reply-flows.md#registrar).

## `m.reply is not a function` dentro de un plugin de reacción

Los plugins de reacción corren antes del handler que añade `m.reply` (0.13 < 0.15). Usa `sock.sendMessage`. Ver [Plugins](plugins.md#reacción).

## `this` es `undefined` en mi handler

Escribiste el `script` como función flecha. Debe ser `async function () {}`. Ver [Handlers](handlers.md#escribir-un-handler).

## No arranca: `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite` o pide `--experimental-sqlite`

Tu Node es demasiado antiguo. Usa 22.13 o superior (`node -v`). `package.json` declara `>=18`, pero la sesión necesita `node:sqlite`.

## El bot se reinicia cada 2 segundos

El proceso hijo termina nada más arrancar y el padre lo relanza sin límite. Mira el error justo antes del reinicio. Causas habituales: error de sintaxis en `config.js`, carpeta de `MODULEREGISTRY` inexistente (`Folder not found`), `STORAGE missing`, o falta de permisos sobre `storage/`.

## Pedía QR y ahora no pregunta nada / quiero vincular otro número

El menú solo aparece si **no existe** sesión (`storage/creds/main/session.sqlite`, `session.json` o `creds.json`). Detén el bot y borra `storage/creds`.

## Me desvinculó y perdí la sesión

Al recibir `loggedOut`, `badSession`, `multideviceMismatch` o `forbidden` el framework borra `storage/creds`. Vincula de nuevo. Si quieres un respaldo, copia `session.sqlite` mientras el bot está detenido.

## `Bad MAC`, mensajes que no se descifran

Suele indicar claves Signal que no se pudieron guardar. Los errores de escritura de la sesión se silencian, así que verifica espacio en disco y permisos de `storage/creds`. Si persiste, vuelve a vincular.

## `antiCall` no rechaza llamadas

Con `antiCallWhitelist: [""]` (el valor por defecto) **todo** llamante queda permitido. Déjala en `[]` o con números reales. Ver [Configuración](configuration.md).

## Edité un builder o `socket.extensions.js` y no cambia nada

Se aplican una sola vez al conectar y los builders se importan de forma estática. Reinicia el bot. Ver [Arquitectura](architecture.md#límites-del-hot-reload).

## El consumo de memoria sube con el tiempo

Cada recarga en caliente deja el módulo anterior en memoria, y `inspectPlugins()` reimporta todos los plugins en cada llamada. Reinicia tras muchas ediciones y cachea el resultado de `inspectPlugins`.

## Los mensajes "ver una vez" no se guardan

El handler `m.viewonce.cache.js` no termina en `.handler.js` y no se carga. Renómbralo.

## Stickers o conversión de video fallan

Falta ffmpeg. Comprueba `ffmpeg -version` o reinstala la dependencia opcional `ffmpeg-static`.

## `npm install` falla

`@syllkom/hyper-db` y `baileys-ipc` se instalan desde GitHub: necesitas `git` y acceso a internet. Con `@whiskeysockets/baileys` en `latest`, una versión nueva puede romper los builders; si pasa, fija la versión anterior en `package.json`.

## En el evento de grupo `even` sale `undefined` / no encuentro `event`

El nombre real de la propiedad es `even`. Ver [Plugins](plugins.md#evento-de-grupo-stubtype).
