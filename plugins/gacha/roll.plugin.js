// ./plugins/gacha/roll.plugin.js
const COOLDOWN = 15 * 60 * 1000 // 15 Minutos

export default {
    command: true, usePrefix: true, 
    case: ['rw', 'roll', 'gacha'], 
    description: 'Tira la ruleta gacha para obtener y reclamar personajes aleatorios.',
    category: 'gacha',
    usage: 'rw',
    script: async (m, { sock, plugin }) => {
        const gacha = plugin.import('@gacha')
        const rpg = plugin.import('@rpg')
        
        const { user } = await rpg.getUser(m.sender.id)
        
        const now = Date.now()
        const lastRoll = user.lastRoll || 0
        const timeDiff = now - lastRoll
        
        if (timeDiff < COOLDOWN) {
            const remaining = Math.ceil((COOLDOWN - timeDiff) / 1000 / 60)
            return m.reply(`Sistema en enfriamiento. Espera ${remaining} minutos.`)
        }

        const char = await gacha.roll()
        
        if (!char) {
            await m.react('error')
            return m.reply('Error de conexión con la base de datos de imágenes.')
        }
        
        user.lastRoll = now
        await m.react('wait')

        let status = await gacha.getStatus(char.id)
        const meta = gacha.meta(char.rarity)

        const isGeneric = char.name === 'Personaje Original' || char.source === 'Original' || char.name === 'Unknown'

        if (!status.isClaimed && !isGeneric) {
            const db = await global.db.open('@rpg')
            const globalGacha = db.gacha?.global || {}

            for (const key in globalGacha) {
                const entry = globalGacha[key]
                if (entry && typeof entry === 'object') {
                    if (entry.name === char.name && entry.source === char.source) {
                        status.isClaimed = true
                        status.owner = entry.owner
                        break
                    }
                }
            }
        }

        const valFmt = (char.value || 0).toLocaleString('es-ES')
        const volFmt = (char.franchiseVol || 0).toLocaleString('es-ES')
        const tierIndicator = char.tierLabel === 'GOD' ? 'GOD ♾' : `Tier ${char.tierLabel}`
        const ownerInfo = status.isClaimed ? `@${status.owner.split('@')[0]}` : 'Ninguno'

        const txt = [
            `╭○ *${meta.name} / ${char.rarity}*`,
            `╵✧ Nombre: ${char.name}`,
            `╵✦ Origen: ${char.source}`,
            `╵✎ Autor: ${char.artist || 'Desconocido'}`,
            '╰╶╴──────╶╴─╶╴◯',
            '',
            '— *Estadísticas!* ๑ 🍥 ୧',
            `╭✰ Valor: ${valFmt}`,
            `﹕✤ Calidad (Likes): ${char.favs}`,
            `﹕⭎⭏ Fama (Volumen): ${tierIndicator}`,
            `﹕(${volFmt} posts)`,
            `﹕¿? Estado: ${status.isClaimed ? 'RECLAMADO' : 'DISPONIBLE'}`,
            `╰» *Propietario:* ${ownerInfo}`,
            ''
        ].join('\n')

        const msgId = 'HK_ROLL_' + Date.now().toString(36)

        await sock.sendMessage(m.chat.id, { 
            mediaMenu: {
                image: char.image,
                body: txt,
                footer: 'ⓘ Responde "claim" o "c" para reclamar o presiona el botón de abajo.',
                inline: true,
                buttons: [
                    { type: 'reply', text: 'Inventario Ⰶ', id: '.col' },
                    { type: 'reply', text: 'Reclamar 🜲', id: 'claim' }
                ]
            }
        }, { 
            messageId: msgId,
            mentions: status.owner ? [status.owner] : [],
            quoted: m.raw 
        })

        if (status.isClaimed) return await m.react('done')

        await sock.setReplyHandler({ key: { id: msgId } }, {
            security: { userId: 'all', chatId: m.chat.id },
            lifecycle: { consumeOnce: false },
            state: { 
                charData: char,
                roller: m.sender.id, 
                spawnTime: Date.now(),
                msgId: msgId
            },
            routes: [{
                code: {
                    executor: async (m, ctx) => {
                        const gacha = ctx.sock.plugins.import('@gacha')
                        const rpg = ctx.sock.plugins.import('@rpg')
                        const body = (m.content?.text || m.body || '').toLowerCase().trim()
                        
                        if (['c', 'claim', 'mio', 'reclamar'].includes(body)) {
                            const groupMeta = await ctx.sock.groupMetadata(m.chat.id).catch(() => null)
                            if (groupMeta && groupMeta.announce) {
                                return m.reply('ⓘ *Anti-Cheat Activado*\nNo se permite reclamar personajes mientras el grupo está cerrado.')
                            }

                            const PROTECTION = 15000 
                            const timePassed = Date.now() - ctx.state.spawnTime
                            const isRoller = m.sender.id === ctx.state.roller
                            
                            if (!isRoller && timePassed < PROTECTION) {
                                const left = Math.ceil((PROTECTION - timePassed) / 1000)
                                return m.reply(`ⓘ Bloqueado. Espera ${left}s para intentar robar.`)
                            }
                            
                            const currentStatus = await gacha.getStatus(ctx.state.charData.id)
                            
                            if (currentStatus.isClaimed) {
                                const dbHandler = await global.db.open('@reply:Handler')
                                if (dbHandler[ctx.state.msgId]) delete dbHandler[ctx.state.msgId]
                                return m.reply('Personaje ya reclamado.')
                            }
                            
                            const success = await gacha.claim(m.sender.id, ctx.state.charData)
                            
                            if (success) {
                                const { user: rpgUser } = await rpg.getUser(m.sender.id)
                                rpgUser.exp += 50 

                                await m.reply(`✦ *Adquisición Exitosa*\nHas obtenido a: ${ctx.state.charData.name}\nValor: ${ctx.state.charData.value.toLocaleString()}`)
                                const dbHandler = await global.db.open('@reply:Handler')
                                delete dbHandler[ctx.state.msgId] 
                                return true
                            } else {
                                await m.reply(`Error en la transacción.`)
                                return true
                            }
                        }

                        return false
                    }
                }
            }]
        }, 60000 * 2)
        
        await m.react('done')
    }
}