// ./plugins/tools/viewonce.plugin.js
export default {
    command: true,
    usePrefix: true,
    case: ['vv', 'rvo', 'viewonce', 'verunavez'],
    list: [
        { cmd: 'vv (responde a un viewonce)', category: 'herramientas' }
    ],
    description: 'Descarga y revela mensajes multimedia de Ver Una Sola Vez',
    script: async (m, { sock }) => {
        if (!m.quoted || !m.quoted.content?.isMedia) {
            return await m.reply('ⓘ Responde a un mensaje de "Ver una sola vez" (Imagen, Video o Audio).')
        }

        await m.react('wait')

        let buffer
        try {
            buffer = await m.getQuotedMedia()
            if (!buffer || !buffer.length) throw new Error('Buffer vacío')
        } catch {
            await m.react('error')
            return await m.reply('✖️ No se pudo descargar el contenido. Quizás ya expiró o fue eliminado del servidor.')
        }

        const isPrivileged = m.sender.role('root', 'owner')

        if (!isPrivileged) {
            await m.reply('⌛ *Contenido Capturado*\nRevelando en 30 segundos...')
            await new Promise(resolve => setTimeout(resolve, 30000))
        }

        await m.react('done')

        const mime = m.quoted.content.media?.mimeType || ''
        const senderTag = m.sender.number ? `@${m.sender.number}` : m.sender.name
        const caption = `ⓘ *ViewOnce Revelado*\n\nSolicitado por: ${senderTag}`
        const targetChat = m.chat.id

        if (mime.startsWith('image/')) {
            await sock.sendMessage(targetChat, {
                image: buffer,
                caption: caption,
                contextInfo: { mentionedJid: [m.sender.id] }
            }, { quoted: m.raw })
        } else if (mime.startsWith('video/')) {
            await sock.sendMessage(targetChat, {
                video: buffer,
                caption: caption,
                contextInfo: { mentionedJid: [m.sender.id] }
            }, { quoted: m.raw })
        } else if (mime.startsWith('audio/')) {
            await sock.sendMessage(targetChat, {
                audio: buffer,
                mimetype: 'audio/mp4',
                ptt: true,
                contextInfo: { mentionedJid: [m.sender.id] }
            }, { quoted: m.raw })
        } else {
            await sock.sendMessage(targetChat, {
                document: buffer,
                mimetype: mime || 'application/octet-stream',
                caption: caption,
                fileName: m.quoted.content.media?.fileName || 'viewonce_revealed.bin',
                contextInfo: { mentionedJid: [m.sender.id] }
            }, { quoted: m.raw })
        }
    }
}