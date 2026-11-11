// ./handlers/m.assign.handler.js

export default {
    enabled: true,
    priority: 0.15,
    script: async function ({ sock }) {
        const m = this

        m.db = async (id) => {
            if (!global.db) return {}
            if (id.endsWith('@g.us')) {
                return await global.db.open('@chat:' + id)
            } else if (id.endsWith('@lid') || id.endsWith('@s.whatsapp.net')) {
                const users = await global.db.open('@users')
                if (!users[id]) {
                    users[id] = {
                        name: '',
                        banned: false,
                        roles: {}
                    }
                }
                return users[id]
            }
        }

        m.reply = async (text, options = {}) => {
            try {
                const q = options.quoted?.raw || options.quoted || (m.raw ? m.raw : null)
                let quotedContext = {}
                if (q) {
                    const qKey = q.key || {}
                    const qId = qKey.id || q.id
                    const qParticipant = qKey.participant || q.participant || qKey.remoteJid || m.chat.id
                    const qMessage = q.message || q.quotedMessage || (qKey.id ? undefined : q)

                    if (qId && qMessage) {
                        quotedContext = {
                            stanzaId: qId,
                            participant: qParticipant,
                            quotedMessage: qMessage
                        }
                    }
                }

                const textLength = typeof text === 'string' ? text.length : (text?.text?.length || 15)
                const isHumanMode = Boolean(global.config?.humanizer !== false && global.config?.human !== false)

                if (isHumanMode) {
                    await sock.sendPresenceUpdate('composing', m.chat.id)
                    const typingDelay = Math.min(textLength * 25, 2500) + Math.floor(Math.random() * 300)
                    await new Promise(resolve => setTimeout(resolve, typingDelay))
                    await sock.sendPresenceUpdate('paused', m.chat.id)
                }

                if (!global.config?.alwaysOnline) {
                    try { await sock.sendPresenceUpdate('unavailable') } catch {}
                }

                const isComplexObject = typeof text === 'object' && text !== null && !text.text
                if (isComplexObject || isHumanMode) {
                    const finalOptions = {
                        ...(q ? { quoted: q } : {}),
                        ...options
                    }

                    if (typeof text === 'string') {
                        const mentionedJid = (text.match(/@(\d{0,16})/g) || []).map(v => v.slice(1) + '@lid')
                        return await sock.sendMessage(m.chat.id, { text, contextInfo: { mentionedJid } }, finalOptions)
                    } else {
                        return await sock.sendMessage(m.chat.id, text, finalOptions)
                    }
                }

                const targetText = typeof text === 'string' ? text : (text?.text || '')
                const mentionedJid = (targetText.match(/@(\d{0,16})/g) || []).map(v => v.slice(1) + '@lid')
                const watermark = '@' + (global.config?.name || 'Aethero')

                const payload = {
                    interactiveMessage: {
                        header: { hasMediaAttachment: false },
                        body: { text: targetText },
                        footer: { text: watermark },
                        nativeFlowMessage: {
                            buttons: [],
                            messageVersion: 1
                        },
                        contextInfo: {
                            mentionedJid,
                            ...quotedContext
                        }
                    }
                }

                const nodes = [{
                    tag: "biz",
                    attrs: {},
                    content: [{
                        tag: "interactive",
                        attrs: { type: "native_flow", v: "1" },
                        content: [{ tag: "native_flow", attrs: { v: "9", name: "mixed" } }]
                    }]
                }]

                return await sock.relayMessage(m.chat.id, payload, { additionalNodes: nodes })

            } catch (e) {
                console.error('[m.reply Error]:', e)
            }
        }

        m.setBan = async (id, state = true) => {
            if (!id) return
            const targetDB = await m.db(id)
            if (targetDB) targetDB.banned = state
        }

        m.setRole = async (id, state, ...roles) => {
            if (!id || !roles.length) return
            const targetDB = await m.db(id)
            if (targetDB) {
                targetDB.roles ||= {}
                for (const role of roles) {
                    targetDB.roles[role] = state
                }
            }
            return true
        }

        m.react = async (text) => {
            if (!text || typeof text !== 'string') return
            const reactEmoji = global.REACT_EMOJIS?.[text] ?? text
            return sock.sendMessage(m.chat.id, {
                react: {
                    text: reactEmoji,
                    key: m.raw.key
                }
            })
        }

        m.sms = (type) => {
            const msg = global.MSG?.[type]
            if (msg) return m.reply(msg)
        }

        m.getQuotedText = () => {
            if (!m.quoted) return ''
            if (m.quoted.content?.text) return m.quoted.content.text
            if (m.quoted.body) return m.quoted.body

            const qMsg = m.quoted.message
            if (!qMsg) return ''

            const realMsg = qMsg.message || qMsg
            return realMsg.conversation ||
                   realMsg.extendedTextMessage?.text ||
                   realMsg.imageMessage?.caption ||
                   realMsg.videoMessage?.caption || ''
        }

        m.getQuotedMedia = async () => {
            if (!m.quoted || !m.quoted.content?.media) return null
            try {
                return await m.quoted.content.media.download()
            } catch (e) {
                console.error('[!] Error descargando media citada:', e.message)
                return null
            }
        }
    }
}