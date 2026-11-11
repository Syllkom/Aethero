// ./plugins/gacha/gift.plugin.js
export default {
    command: true, usePrefix: true, 
    case: ['gift', 'regalar', 'transfer', 'dar'], 
    description: 'Regala o transfiere un personaje de tu inventario a otro usuario.',
    category: 'gacha',
    usage: 'gift ‹id/nombre› @usuario',
    script: async (m, { sock, plugin }) => {
        const gacha = plugin.import('@gacha')
        
        const targetId = m.quoted ? m.quoted.sender.id : m.sender.mentioned[0]
        
        if (!targetId) return m.reply('Debes mencionar o responder al usuario al que quieres regalarle.')
        if (targetId === m.sender.id) return m.reply('No puedes regalarte a ti mismo.')
        if (targetId === m.bot.id) return m.reply('No puedo aceptar regalos, soy un bot.')

        let query = m.text.replace(/@\d+/g, '').trim()
        
        if (!query) return m.reply(`Ingresa el ID o nombre del personaje.\nEjemplo: .gift Miku @usuario`)

        const db = await global.db.open('@rpg')
        const myInv = db.users[m.sender.id]?.inventory || []
        
        let item = myInv.find(i => i.id === query)
        if (!item) {
            item = myInv.find(i => i.name && i.name.toLowerCase().includes(query.toLowerCase()))
        }

        if (!item) return m.reply(`No tienes ningún personaje que coincida con "${query}" en tu inventario.`)

        await m.react('wait')
        let char = await gacha.getById(item.id)
        if (!char) char = item

        const txt = `╭Ⰶ *Confirmar Regalo*\n\n` +
                    `╵ Personaje: *${char.name}*\n` +
                    `╵ Rareza: ${char.rarity}\n` +
                    `╵ Destinatario: @${targetId.split('@')[0]}\n` +
                    '╰╶╴──────╶╴─╶╴◯\n\n' +
                    `_Responde "si" para confirmar la transferencia._`
        
        const msg = await sock.sendMessage(m.chat.id, { text: txt, contextInfo: { mentionedJid: [targetId] } }, { quoted: m.raw })

        await sock.setReplyHandler(msg, {
            security: { userId: m.sender.id, chatId: m.chat.id },
            lifecycle: { consumeOnce: true },
            state: { charId: item.id, targetId: targetId },
            routes: [{
                code: {
                    executor: async (m, ctx) => {
                        const text = m.content?.text || m.body || ''
                        
                        if (['si', 'yes', 'confirmar'].includes(text.toLowerCase().trim())) {
                            const db = await global.db.open('@rpg')
                            
                            const globalEntry = db.gacha?.global?.[ctx.state.charId]
                            const currentOwner = (typeof globalEntry === 'object') ? globalEntry.owner : globalEntry
                            
                            if (currentOwner !== m.sender.id) {
                                return m.reply('✗ Error: Ya no eres el dueño de este personaje.')
                            }

                            if (db.users[m.sender.id]?.inventory) {
                                const inventory = db.users[m.sender.id].inventory
                                const idx = inventory.findIndex(i => i.id === ctx.state.charId)
                                
                                if (idx !== -1) {
                                    const [itemToMove] = inventory.splice(idx, 1)
                                    
                                    db.users[ctx.state.targetId] ||= { inventory: [] }
                                    db.users[ctx.state.targetId].inventory ||= []
                                    
                                    itemToMove.date = Date.now()
                                    db.users[ctx.state.targetId].inventory.push(itemToMove)
                                }
                            }
                            
                            if (globalEntry) globalEntry.owner = ctx.state.targetId
                            
                            const charName = db.users[ctx.state.targetId].inventory.find(i => i.id === ctx.state.charId)?.name || 'Personaje'
                            
                            await m.reply(`✓ Regalo enviado.\n*${charName}* ahora pertenece a @${ctx.state.targetId.split('@')[0]}`, { contextInfo: { mentionedJid: [ctx.state.targetId] } })

                        } else {
                            await m.reply('ⓘ Regalo cancelado.')
                        }
                    }
                }
            }]
        })
        
        await m.react('done')
    }
}