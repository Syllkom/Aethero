# Documentación de Aethero

Organizada por lo que necesitas hacer, no por el orden del código.

**Aprender**
1. [Primeros pasos](getting-started.md): instalar, vincular, primer plugin.
2. [Arquitectura](architecture.md): procesos, pipeline, hot-reload y sus límites.

**Hacer**
- [Plugins](plugins.md) · [Flujos de respuesta](reply-flows.md) · [Sub-bots](subbots.md) · [Solución de problemas](troubleshooting.md)

**Consultar**
- [Objeto `m`](message-object.md) · [Handlers](handlers.md) · [API del socket](socket-api.md) · [Builders](builders-reference.md) · [Configuración](configuration.md) · [Almacenamiento y sesión](storage-and-auth.md)

## Convenciones

- Los fragmentos marcados con ✅ fueron contrastados con el código de la rama `framework`.
- Los marcados con ⚠️ describen comportamiento que conviene probar antes de depender de él.
- `m` es el objeto de mensaje; `sock` es el socket de Baileys extendido.
