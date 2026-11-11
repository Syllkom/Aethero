// ./plugins/gacha/trade.plugin.js
export default {
    command: true, usePrefix: true,
    case: ['trade', 'cambiar', 'intercambio'],
    description: 'Intercambia un personaje de tu inventario con otro usuario.',
    category: 'gacha',
    usage: 'trade ‹mi_id› @usuario ‹su_id›',
    script: async (m, { sock, plugin }) => {
        const gacha = plugin.import('@gacha')
        
        if (m.args.length < 2 || m.sender.mentioned.length === 0) {
            return m.reply(`ⓘ *Sistema De Intercambio*\n\nUso: .trade ‹tu_char_id› @usuario ‹su_char_id›\nEjemplo: .trade 102030 @Syllkom 506070`)
        }

        const targetUser = m.sender.mentioned[0]
        const myCharId = m.args[0]
        const targetCharId = m.args[m.args.length - 1] 

        if (targetUser === m.sender.id) return m.reply('No puedes cambiar contigo mismo.')
        if (targetUser === m.bot.id) return m.reply('Yo no colecciono, solo administro.')

        const db = await global.db.open('@rpg')
        db.users ||= {}

        const myInv = db.users[m.sender.id]?.inventory || []
        const targetInv = db.users[targetUser]?.inventory || []

        const myItem = myInv.find(i => i.id === myCharId)
        const targetItem = targetInv.find(i => i.id === targetCharId)

        if (!myItem) return m.reply(`No tienes el personaje con ID: ${myCharId}`)
        if (!targetItem) return m.reply(`El usuario @${targetUser.split('@')[0]} no tiene el personaje ID: ${targetCharId}`)

        await m.react('wait')
        const myCharData = await gacha.getById(myCharId) || myItem
        const targetCharData = await gacha.getById(targetCharId) || targetItem

        const txt = `✦ *Solicitud De Intercambio*\n\n` +
                    `@${m.sender.number} ofrece:\n` +
                    `  » *${myCharData.name}* [${myCharData.rarity}]\n` +
                    `  » Val: ${(myCharData.value || 0).toLocaleString()}\n\n` +
                    `A cambio de tu:\n` +
                    `  » *${targetCharData.name}* [${targetCharData.rarity}]\n` +
                    `  » Val: ${(targetCharData.value || 0).toLocaleString()}\n\n` +
                    `⚠ @${targetUser.split('@')[0]}, responde "aceptar" para realizar el cambio.`

        const msg = await sock.sendMessage(m.chat.id, { 
            text: txt, 
            contextInfo: { mentionedJid: [m.sender.id, targetUser] }
        }, { quoted: m.raw })

        await sock.setReplyHandler(msg, {
            security: { userId: targetUser, chatId: m.chat.id },
            lifecycle: { consumeOnce: true },
            state: { 
                proposer: m.sender.id,
                acceptor: targetUser,
                item1: myCharId,
                item2: targetCharId
            },
            routes: [{
                code: {
                    executor: async (m, ctx) => {
                        const text = (m.content?.text || m.body || '').toLowerCase().trim()
                        
                        if (['si', 'yes', 'aceptar', 'deal'].includes(text)) {
                            const db = await global.db.open('@rpg')
                            
                            const p1Inv = db.users[ctx.state.proposer]?.inventory || []
                            const p2Inv = db.users[ctx.state.acceptor]?.inventory || []

                            const idx1 = p1Inv.findIndex(i => i.id === ctx.state.item1)
                            const idx2 = p2Inv.findIndex(i => i.id === ctx.state.item2)

                            if (idx1 === -1) return m.reply('✗ Error: El solicitante ya no tiene el ítem.')
                            if (idx2 === -1) return m.reply('✗ Error: Ya no tienes el ítem solicitado.')

                            const [obj1] = p1Inv.splice(idx1, 1)
                            const [obj2] = p2Inv.splice(idx2, 1)
                            
                            obj1.date = Date.now()
                            obj2.date = Date.now()
                            
                            p1Inv.push(obj2)
                            p2Inv.push(obj1)

                            db.gacha.global ||= {}
                            
                            const g1 = db.gacha.global[ctx.state.item1]
                            const g2 = db.gacha.global[ctx.state.item2]
                            
                            if (g1) g1.owner = ctx.state.acceptor
                            if (g2) g2.owner = ctx.state.proposer

                            await m.reply(`✓ *¡Intercambio Completado!*`)

                        } else {
                            await m.reply('✗ Intercambio rechazado o cancelado.')
                        }
                    }
                }
            }]
        })
        
        await m.react('done')
    }
}