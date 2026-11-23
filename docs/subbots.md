# Sub-bots

Un sub-bot es una **segunda (o enésima) cuenta de WhatsApp** ejecutada dentro del mismo proceso, cada una en su propio `worker_threads` con sesión y base de datos separadas. Reutiliza tus plugins y handlers. El motor es `baileys-ipc` (fork de Aethero).

## Gestor

`global.subbots` es un `BaileysIPC` creado al abrir la conexión principal ✅:

```js
const manager = global.subbots

// Crear y arrancar (QR o pin)
const inst = await manager.spawnSubbot('cliente1', { connectType: 'qr-code' })
const inst2 = await manager.spawnSubbot('cliente2', { connectType: 'pin-code', phoneNumber: '51999999999' })

manager.InstancesActive()          // ['cliente1', ...]
manager.getInstance('cliente1')    // InstanceIPC | undefined
manager.hasStoredInstance('cliente1')
await manager.destroyInstance('cliente1')   // detiene y borra su sesión
```

`connectType` y, si es `pin-code`, `phoneNumber` son obligatorios. El `id` debe ser único.

Al arrancar el bot principal, se **restauran automáticamente** todas las sesiones guardadas en `storage/subs`.

## Eventos de una instancia

`instance.on('connection.update', update)` con `update.type`:

| `type` | Significado |
|---|---|
| `connection_open` | Sesión conectada. |
| `connection_close` | Cerrada; `update.action` es `'restart'` o `'stop'` y `update.reasonCode` el código. |
| `connection_pairing` | Datos de vinculación; con QR trae `qrcode: true` y `data.qrCodeText`. ⚠️ Revisa el payload para el modo pin. |

Además `instance.on('messages.upsert', ...)` y `instance.on('exit', ...)`.

## Qué cambia respecto al bot principal

| Aspecto | Sub-bot |
|---|---|
| Pipeline | El mismo, con los mismos handlers y plugins. |
| `sock` | Proxy hacia el worker: las llamadas viajan por IPC. `sock.isSubbot === true`. |
| `m.sock` y `conn` | Disponibles (`m.sock` solo existe aquí). |
| `global.db` | Apunta a `storage/subs/<id>/store` durante el pipeline de ese sub-bot. |
| `m.quoted` | Se construye solo con lo que trae la cita; **no** se completa desde el historial. |
| Foto de perfil | Se delega en el socket del bot principal. |

⚠️ Como `global.db` cambia según el sub-bot que esté ejecutándose, no guardes referencias a `global.db` en variables de módulo: llámalo siempre dentro del `script`.
