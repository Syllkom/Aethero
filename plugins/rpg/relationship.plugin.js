// ./plugins/rpg/relationship.plugin.js
export default {
    command: true, usePrefix: true, 
    case: ['couple', 'divorce', 'terminar'],
    description: 'Gestiona parejas, matrimonios y divorcios entre usuarios.',
    category: 'RPG',
    usage: ['couple @user', 'divorce'],
    script: async (m, { sock, plugin }) => {
        const rpg = plugin.import('@rpg')
        const { user: me } = await rpg.getUser(m.sender.id)

        if (['divorce', 'terminar'].includes(m.command)) {
            if (!me.partner) return m.reply('No tienes pareja para terminar.')
            
            const exPartnerId = me.partner
            const { user: ex } = await rpg.getUser(exPartnerId)
            
            me.partner = null
            ex.partner = null
            
            return m.reply(`💔 Relación terminada. Ahora estás soltero(a).`)
        }

        if (!m.text && !m.quoted) return m.reply('Menciona a la persona con quien quieres estar.')
        
        const targetId = m.quoted ? m.quoted.sender.id : m.sender.mentioned[0]
        if (!targetId) return m.reply('Usuario no válido.')
        if (targetId === m.sender.id) return m.reply('No puedes ser pareja de ti mismo.')
        if (targetId === m.bot.id) return m.reply('Yo no puedo tener pareja, soy un bot.')

        const { user: target } = await rpg.getUser(targetId)

        if (me.partner) return m.reply(`Ya tienes pareja: @${me.partner.split('@')[0]}`)
        if (target.partner) return m.reply(`Esa persona ya tiene pareja.`)

        const txt = `💘 *PROPUESTA DE RELACIÓN*\n\nHola @${targetId.split('@')[0]}, el usuario @${m.sender.number} quiere formar una pareja contigo.\n\nResponde "yes" o "si" para aceptar.`
        
        const msg = await sock.sendMessage(m.chat.id, { text: txt, contextInfo: { mentionedJid: [m.sender.id, targetId] } }, { quoted: m.raw })

        await sock.setReplyHandler(msg, {
            security: { userId: targetId, chatId: m.chat.id },
            lifecycle: { consumeOnce: true },
            state: { proposer: m.sender.id },
            routes: [{
                code: {
                    executor: async (m, ctx) => {
                        const bodyText = (m.content?.text || m.body || '').toLowerCase().trim()
                        if (['si', 'yes', 'aceptar'].includes(bodyText)) {
                            const rpg = ctx.sock.plugins.import('@rpg')
                            const { user: u1 } = await rpg.getUser(ctx.state.proposer)
                            const { user: u2 } = await rpg.getUser(m.sender.id)

                            if (u1.partner || u2.partner) return m.reply('Uno de los dos ya consiguió pareja mientras esperaban.')

                            u1.partner = m.sender.id
                            u2.partner = ctx.state.proposer
                            
                            await m.reply(`💖 *¡FELICIDADES!*\nAhora @${ctx.state.proposer.split('@')[0]} y @${m.sender.number} son pareja.`, { contextInfo: { mentionedJid: [ctx.state.proposer, m.sender.id] } })
                        } else {
                            await m.reply('💔 Propuesta rechazada.')
                        }
                    }
                }
            }]
        })
    }
}