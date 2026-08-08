// ./plugins/group/tagall.plugin.js
export default {
    command: true, usePrefix: true,
    case: ['todos', 'invocar', 'tagall'],
    description: 'Menciona a todos los miembros del grupo con un mensaje personalizado.',
    category: 'grupo',
    usage: 'todos ‹mensaje›',
    script: async (m, { sock }) => {
        if (!m.chat.isGroup) return m.sms('group')
        if (!m.sender.role('admin', 'owner', 'root')) return m.sms('admin')

        const customText = m.text.trim() || 'Atención a todos los miembros.'
        const participants = m.chat.participants || []

        if (participants.length === 0) return m.reply('ⓘ No se encontraron participantes en este grupo.')

        await m.react('📢')

        let txt = `╭▢ *INVOCACIÓN GENERAL*\n`
        txt += `╵ Mensaje: *${customText}*\n`
        txt += `╵ Miembros: *${participants.length}*\n`
        txt += `╰╶╴──────╶╴─╶╴◯\n\n`

        const mentions = []
        participants.forEach((p, i) => {
            const jid = p.id || p.jid
            mentions.push(jid)
            txt += `▸ @${jid.split('@')[0]}\n`
        })

        await sock.sendMessage(m.chat.id, {
            text: txt,
            contextInfo: { mentionedJid: mentions }
        }, { quoted: m.raw })

        await m.react('done')
    }
}