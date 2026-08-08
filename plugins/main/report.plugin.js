const COOLDOWN_MS = 5 * 60 * 1000
const cooldowns = new Map()

const getOwnerJid = (sock) => sock.user?.id?.replace(/:\d+@/, '@') || null

export default {
    command: true, usePrefix: true,
    case: ['reportar', 'report', 'reporte'],
    category: 'main',
    description: 'Envía reportes directamente al administrador, permitiendo adjuntar mensajes, imágenes, videos o archivos para facilitar la revisión de problemas.',
    usage: 'reportar ‹motivo›',
    script: async (m, { sock }) => {
        const ownerJid = getOwnerJid(sock)
        if (!ownerJid) return m.reply('ⓘ No se pudo enviar el reporte.')

        const now = Date.now()
        const lastUse = cooldowns.get(m.sender.id)
        if (lastUse && (now - lastUse) < COOLDOWN_MS) {
            const remaining = Math.ceil((COOLDOWN_MS - (now - lastUse)) / 1000)
            const mins = Math.floor(remaining / 60)
            const secs = remaining % 60
            return m.reply(`ⓘ Ya enviaste un reporte recientemente. Esperá ${mins}m ${secs}s antes de reportar de nuevo.`)
        }

        const motivo = m.text?.trim()
        if (!motivo) return m.reply(
            `ⓘ *¿Cómo usar .reportar?*\n\n` +
            `Escribe el motivo del reporte:\n` +
            `_.reportar <motivo>_\n\n` +
            `Podés también responder a un mensaje para incluirlo en el reporte.`
        )

        await m.react('wait')

        const chatInfo = m.chat.isGroup
            ? `▢ Grupo: ${m.chat.name || m.chat.id}\n   ID: \`${m.chat.id}\``
            : `▢ Chat Privado: \`${m.chat.id}\``

        const senderInfo = [
            `▢ *Reportado por:* @${m.sender.number || m.sender.id.split('@')[0]}`,
            `   ID: \`${m.sender.id}\``,
            `   Nombre: ${m.sender.name || 'Sin nombre'}`,
            `   Rol: ${m.sender.roles.root ? 'Root' : m.sender.roles.owner ? 'Owner' : m.sender.roles.admin ? 'Admin' : 'Usuario'}`
        ].join('\n')

        const timestamp = new Date().toLocaleString('es-ES', {
            timeZone: 'America/Lima',
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        })

        const reporteTxt = [
            `ᵎ!ᵎ *NUEVO REPORTE*`,
            ``,
            `ⓘ *Motivo:*`,
            motivo,
            ``,
            senderInfo,
            ``,
            chatInfo,
            ``,
            `𝄜 Fecha: ${timestamp}`,
            m.quoted ? `\nⓘ _Incluye mensaje citado_` : ''
        ].join('\n')

        try {
            if (m.quoted && m.quoted.content?.media) {
                const buffer = await m.quoted.content.media.download()
                const mime   = m.quoted.content.media.mimeType || ''

                await sock.sendMessage(ownerJid, { text: reporteTxt })

                if (mime.startsWith('image/')) {
                    await sock.sendMessage(ownerJid, {
                        image: buffer,
                        caption: `☍ Media adjunta al reporte`
                    })
                } else if (mime.startsWith('video/')) {
                    await sock.sendMessage(ownerJid, {
                        video: buffer,
                        caption: `☍ Video adjunto al reporte`
                    })
                } else {
                    await sock.sendMessage(ownerJid, {
                        document: buffer,
                        mimetype: mime,
                        fileName: 'adjunto_reporte'
                    })
                }
            } else if (m.quoted) {

                await sock.sendMessage(ownerJid, { text: reporteTxt })
                await sock.sendMessage(ownerJid, {
                    text: `ⓘ *Mensaje reportado:*\n\n${m.quoted.content?.text || '(sin texto)'}`,
                })
            } else {
                await sock.sendMessage(ownerJid, { text: reporteTxt })
            }

            cooldowns.set(m.sender.id, now)
            setTimeout(() => cooldowns.delete(m.sender.id), COOLDOWN_MS)

            await m.react('done')
            await m.reply(`✓ Tu reporte fue enviado al administrador.\n_Podés enviar otro en 5 minutos._`)

        } catch (e) {
            console.error('[reportar] Error:', e.message)
            await m.react('error')
            await m.reply('ⓘ No se pudo enviar el reporte. Intentá de nuevo más tarde.')
        }
    }
}
