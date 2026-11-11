// ./plugins/group/hidetag.plugin.js
const sentTagIds = new Set()

export default {
    command: true, usePrefix: true,
    case: ['notificar', 'hidetag', 'n', 'tag'],
    category: 'group', description: 'Notifica a todos los miembros del grupo en texto o multimedia.',
    usage: ['tag ‹texto›', 'tag ‹citar archivo›'],
    script: async (m, { sock }) => {
        if (!m.chat.isGroup) return m.sms('group')

        const isAuthorized = Boolean(m.sender.isAdmin || m.sender.role('owner', 'root', 'bot'))
        if (!isAuthorized) return m.sms('admin')

        if (m.id && sentTagIds.has(m.id)) return

        const rawParticipants = m.chat.participants || []
        const cleanParticipants = rawParticipants
            .map(p => p.id || p.jid)
            .filter(Boolean)
            .map(jid => {
                const base = jid.split('@')[0].split(':')[0]
                const domain = jid.includes('@') ? jid.split('@')[1] : 's.whatsapp.net'
                return `${base}@${domain}`
            })

        const participants = [...new Set(cleanParticipants)]
        if (!participants.length) return m.reply('[!] No se encontraron participantes en este grupo.')

        const textArg = m.args.join(' ').trim()
        const quotedText = m.getQuotedText ? m.getQuotedText() : (m.quoted?.content?.text || m.quoted?.body || '')
        const messageText = textArg || quotedText.trim()

        const isDirectMedia = Boolean(m.content?.isMedia && m.content?.media)
        const isQuotedMedia = Boolean(m.quoted?.content?.isMedia && m.quoted?.content?.media)
        const mediaSource = isDirectMedia ? m : (isQuotedMedia ? m.quoted : null)

        if (!mediaSource && !messageText) {
            return m.reply('[!] Ingresa un texto o cita un archivo multimedia para notificar.')
        }

        await m.react('wait')

        let sentMsg = null

        if (mediaSource) {
            const buffer = isDirectMedia
                ? await m.content.media.download()
                : await m.getQuotedMedia()

            if (!buffer || !buffer.length) {
                await m.react('error')
                return m.reply('[!] No se pudo procesar el archivo multimedia.')
            }

            const mediaType = mediaSource.type
            const mimeType = mediaSource.content?.media?.mimeType || ''

            if (mediaType === 'imageMessage') {
                sentMsg = await sock.sendMessage(m.chat.id, {
                    image: buffer,
                    caption: messageText,
                    contextInfo: { mentionedJid: participants }
                })
            }
            else if (mediaType === 'videoMessage') {
                sentMsg = await sock.sendMessage(m.chat.id, {
                    video: buffer,
                    caption: messageText,
                    mimetype: mimeType || 'video/mp4',
                    contextInfo: { mentionedJid: participants }
                })
            }
            else if (mediaType === 'audioMessage' || mediaType === 'ptvMessage') {
                const isPtt = Boolean(mediaType === 'ptvMessage' || mediaSource.raw?.message?.audioMessage?.ptt)

                sentMsg = await sock.sendMessage(m.chat.id, {
                    audio: buffer,
                    mimetype: mimeType || 'audio/mp4',
                    ptt: isPtt,
                    contextInfo: { mentionedJid: participants }
                })

                if (messageText) {
                    await sock.sendMessage(m.chat.id, {
                        text: messageText,
                        contextInfo: { mentionedJid: participants }
                    })
                }
            }
            else if (mediaType === 'stickerMessage') {
                sentMsg = await sock.sendMessage(m.chat.id, {
                    sticker: buffer,
                    contextInfo: { mentionedJid: participants }
                })

                if (messageText) {
                    await sock.sendMessage(m.chat.id, {
                        text: messageText,
                        contextInfo: { mentionedJid: participants }
                    })
                }
            }
            else if (mediaType === 'documentMessage') {
                sentMsg = await sock.sendMessage(m.chat.id, {
                    document: buffer,
                    caption: messageText,
                    fileName: mediaSource.content?.media?.fileName || 'documento',
                    mimetype: mimeType || 'application/octet-stream',
                    contextInfo: { mentionedJid: participants }
                })
            }
        } else {
            sentMsg = await sock.sendMessage(m.chat.id, {
                text: messageText,
                contextInfo: { mentionedJid: participants }
            })
        }

        if (sentMsg?.key?.id) {
            sentTagIds.add(sentMsg.key.id)
            setTimeout(() => sentTagIds.delete(sentMsg.key.id), 60000)
        }

        await m.react('done')
    }
}