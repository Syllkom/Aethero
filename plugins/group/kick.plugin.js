// ./plugins/group/kick.plugin.js
export default {
    command: true, usePrefix: true,
    case: ['kick', 'expulsar', 'sacar', 'remove'],
    description: 'Expulsa a un miembro del grupo mediante mención o respuesta.',
    category: 'grupo',
    usage: 'kick @usuario',
    script: async (m) => {
        if (!m.chat.isGroup) return m.sms('group')
        if (!m.sender.role('admin', 'owner', 'root')) return m.sms('admin')
        if (!m.bot.roles.admin) return m.sms('botAdmin')

        const target = m.sender.mentioned[0] || m.quoted?.sender?.id

        if (!target) return m.reply('ⓘ Menciona o cita al usuario que deseas expulsar.')
        if (target === m.bot.id) return m.reply('ⓘ No me puedo expulsar a mí mismo.')
        if (target === m.sender.id) return m.reply('ⓘ No te puedes expulsar a ti mismo.')

        const targetName = target.split('@')[0]
        const admins = m.chat.admins || []

        if (admins.includes(target)) {
            return m.reply('✗ No puedes expulsar a otro administrador del grupo.')
        }

        await m.react('🚫')

        try {
            await m.chat.remove(target)
            await m.reply(`✓ Usuario @${targetName} expulsado del grupo.`, { contextInfo: { mentionedJid: [target] } })
            await m.react('done')
        } catch (e) {
            console.error('Kick Error:', e)
            await m.react('error')
            await m.reply('ⓘ Error al intentar expulsar al usuario.')
        }
    }
}