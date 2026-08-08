// ./plugins/events/before.antibot.plugin.js
const groupAlerts = new Map()
const suspects = new Map()

export default {
    before: true,
    priority: 1,
    command: false,
    description: 'Middleware silencioso de protección anti-bots mediante heurística de 3 strikes.',
    script: async (m, { sock, control }) => {
        const chatDb = await m.chat.db()
        if (!chatDb?.settings?.antibot) return
        if (!m.chat.isGroup) return
        if (m.sender.roles.bot || m.sender.role('root', 'owner')) return

        const text = m.content?.text?.trim() || ''
        const prefixes = global.config.prefixes

        const hasPrefix = prefixes && prefixes.includes(text[0])
        if (hasPrefix) {
            groupAlerts.set(m.chat.id, {
                timestamp: Date.now(),
                senderId: m.sender.id,
                triggerText: text
            })
            return
        }

        const activeAlert = groupAlerts.get(m.chat.id)
        if (activeAlert && m.sender.id !== activeAlert.senderId) {
            const delay = Date.now() - activeAlert.timestamp
            groupAlerts.delete(m.chat.id)

            if (delay <= 2000) {
                const suspectKey = `${m.chat.id}:${m.sender.id}`
                let suspect = suspects.get(suspectKey) || { strikes: 0 }

                const getRawType = (msg) => {
                    if (!msg) return null
                    let type = Object.keys(msg)[0]
                    if (type?.includes('viewOnce')) {
                        const inner = msg[type]?.message
                        if (inner) type = Object.keys(inner)[0]
                    }
                    return type
                }
                const rawType = getRawType(m.raw?.message)
                const humanTypes = [
                    'conversation', 'extendedTextMessage', 'imageMessage', 'videoMessage', 
                    'audioMessage', 'stickerMessage', 'documentMessage', 'contactMessage', 
                    'contactsArrayMessage', 'locationMessage', 'liveLocationMessage', 
                    'pollCreationMessage', 'pollUpdateMessage', 'reactionMessage'
                ]
                const ignoreTypes = ['protocolMessage', 'senderKeyDistributionMessage']
                const isAutomatedMsg = rawType && !humanTypes.includes(rawType) && !ignoreTypes.includes(rawType)

                if (isAutomatedMsg) suspect.strikes = 3
                else suspect.strikes += 1

                suspects.set(suspectKey, suspect)

                if (suspect.strikes >= 3) {
                    control.end = true
                    await m.reply(`▢ AntiBot Activo\n● Bot detectado por patrón de respuesta instantánea (3 strikes):\n- Sospechoso: @${m.sender.number}\n- Latencia: ${delay}ms\n- Acción: Expulsando y baneo del sistema...`)

                    try {
                        const targetDB = await m.db(m.sender.id)
                        if (targetDB) {
                            targetDB.banned = true
                            targetDB.isBot = true
                        }

                        if (m.sender.roles.admin) await m.chat.demote(m.sender.id)
                        await m.chat.remove(m.sender.id)
                        suspects.delete(suspectKey)
                    } catch (e) {
                        console.error('[AntiBot Error]', e.message)
                    }
                } else {
                    console.log(`[AntiBot] Strike ${suspect.strikes}/3 para @${m.sender.number} por responder en ${delay}ms`)
                }
            }
        }
    }
}