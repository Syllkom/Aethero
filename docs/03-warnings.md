# ADVERTENCIAS DE USO (Plugins de Owner)

Aethero incluye herramientas avanzadas que interactúan directamente con el protocolo de WhatsApp (Baileys). **El uso indebido de estos plugins puede resultar en el baneo permanente de tu número.**

## 1. `.rich` / Tareas Progresivas (Meta AI)
Este plugin aprovecha la API de edición de Meta AI para crear bucles infinitos de edición en un mensaje. 
- **El Riesgo:** WhatsApp tiene sistemas anti-spam (Rate Limit) que detectan cuando un bot edita un mensaje demasiadas veces por segundo. 
- **Advertencia:** No dejes el comando `.rich --send` activo por horas. Úsalo para pruebas cortas o demostraciones y detenlo con `.rich --stop`.

## 2. `.dmsg` / `.edit` (Borrar y Editar sin ser Admin)
Estos plugins explotan una vulnerabilidad en el protocolo Multi-Dispositivo de WhatsApp (Message Protocol Type 14) para forzar el borrado o la edición de mensajes ajenos.

- **Tasa de éxito:** 
  - Para borrar tus propios mensajes: **100% funcional**.
  - Para borrar mensajes de otros: **50/50**. A veces WhatsApp ignora la petición.
  - **El Truco del Testigo:** Si hay **dos sesiones del bot** (por ejemplo, el bot principal y un Sub-Bot) en el mismo grupo, el servidor de WhatsApp se confunde y permite el borrado en un **100%** de los casos.
- **El Riesgo:** Abusar de esto (borrar 50 mensajes seguidos de otras personas) hará que WhatsApp te banee por "actividad sospechosa". Úsalo con discreción.

## 3. `.vv` (ViewOnce)
Este plugin guarda en caché los mensajes de "Ver una Vez" en el milisegundo en que llegan para poder revelarlos después.
- **Advertencia:** Aunque el archivo se guarda silenciosamente, si el usuario que envió la foto tiene activada la opción de "Confirmación de lectura" en ViewOnce, podría notar que el archivo fue visto de inmediato, incluso si el bot no lo envía al chat.
