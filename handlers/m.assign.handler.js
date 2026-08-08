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
                await sock.sendPresenceUpdate('composing', m.chat.id)

                const textLength = typeof text === 'string' ? text.length : (text?.text?.length || 15)
                const typingDelay = Math.min(textLength * 30, 3000) + Math.floor(Math.random() * 500)

                await new Promise(resolve => setTimeout(resolve, typingDelay))
                await sock.sendPresenceUpdate('paused', m.chat.id)

                const quotedObj = m.raw ? { quoted: m.raw } : {}
                const finalOptions = { ...quotedObj, ...options }

                if (typeof text === 'string') {
                    const mentionedJid = (text.match(/@(\d{0,16})/g) || []).map(v => v.slice(1) + '@lid')
                    return await sock.sendMessage(m.chat.id, { text, contextInfo: { mentionedJid } }, finalOptions)
                } else if (typeof text === 'object') {
                    return await sock.sendMessage(m.chat.id, text, finalOptions)
                }
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
                console.error('Error descargando media citada:', e.message)
                return null
            }
        }
    }
}