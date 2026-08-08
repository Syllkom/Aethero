// ./plugins/group/promote.plugin.js
export default {
    command: true, usePrefix: true,
    case: ['promote', 'demote', 'daradmin', 'quitaradmin'],
    description: 'Gestiona administradores de grupos, permitiendo otorgar o retirar privilegios.',
    category: 'grupo',
    usage: ['promote ‹@user›', 'demote ‹@user›'],
    script: async (m, { sock }) => {
        if (!m.chat.isGroup) return m.sms('group')
        if (!m.sender.role('admin', 'owner', 'root')) return m.sms('admin')
        if (!m.bot.roles.admin) return m.sms('botAdmin')

        const target = m.sender.mentioned[0] || m.quoted?.sender?.id
        
        if (!target) {
            const accion = ['promote', 'daradmin'].includes(m.command) ? 'promover' : 'degradar'
            return m.reply(`ⓘ Menciona o responde al mensaje del usuario que deseas ${accion}.`)
        }

        if (target === m.bot.id) return m.reply('ⓘ No puedo cambiar mis propios permisos con este comando.')
        if (target === m.chat.owner) return m.reply('ⓘ No puedes modificar los permisos del creador del grupo.')

        const isPromote = ['promote', 'daradmin'].includes(m.command)

        try {
            const db = await m.chat.db()
            const detectOn = db.settings?.detect

            if (isPromote) {
                await m.chat.promote(target)
                if (!detectOn) {
                    await sock.sendMessage(m.chat.id, { 
                        text: `✓ @${target.split('@')[0]} ahora es administrador.`, 
                        contextInfo: { mentionedJid: [target] }
                    }, { quoted: m.raw })
                }
            } else {
                await m.chat.demote(target)
                if (!detectOn) {
                    await sock.sendMessage(m.chat.id, { 
                        text: `✓ @${target.split('@')[0]} dejó de ser administrador.`, 
                        contextInfo: { mentionedJid: [target] }
                    }, { quoted: m.raw })
                }
            }
            
            await m.react('done')
            
        } catch (e) {
            console.error('Promote/Demote Error:', e)
            m.reply('ⓘ Ocurrió un error al intentar modificar los permisos del usuario.')
        }
    }
}