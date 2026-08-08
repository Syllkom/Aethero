// ./plugins/group/hidetag.plugin.js
export default {
    command: true, usePrefix: true,
    case: ['notificar', 'hidetag', 'n', 'tag'],
    description: 'Notifica u oculta la mención a todos los miembros del grupo en texto o multimedia.',
    category: 'grupo',
    usage: 'notificar ‹mensaje o imagen›',
    script: async (m, { sock }) => {
        if (!m.chat.isGroup) return m.sms('group')
        if (!m.sender.role('admin', 'owner', 'root')) return m.sms('admin')

        const participants = (m.chat.participants || []).map(p => p.id || p.jid)
        if (participants.length === 0) return m.reply('ⓘ No se encontraron participantes en este grupo.')

        const messageText = m.text.trim() || m.quoted?.content?.text || ''

        await m.react('🔔')

        const targetMedia = (m.content?.media) ? m : (m.quoted?.content?.media) ? m.quoted : null

        if (targetMedia) {
            const buffer = await targetMedia.content.media.download()
            const mediaType = targetMedia.type === 'videoMessage' ? 'video' : 'image'

            await sock.sendMessage(m.chat.id, {
                [mediaType]: buffer,
                caption: messageText,
                contextInfo: { mentionedJid: participants }
            }, { quoted: m.raw })
        } else {
            if (!messageText) return m.reply('ⓘ Ingresa un mensaje o responde a un medio para notificar.')

            await sock.sendMessage(m.chat.id, {
                text: messageText,
                contextInfo: { mentionedJid: participants }
            }, { quoted: m.raw })
        }

        await m.react('done')
    }
}