// ./handlers/m.sender.handler.js
export default {
    enabled: true,
    priority: 0.12,
    script: async function ({ sock }) {
        const m = this
        const isFromMe = !!this.raw.key.fromMe

        const botNum = sock.user?.id?.split(':')[0]
        const rawLid = sock.user?.lid || ''
        const botLid = rawLid ? (rawLid.includes(':') ? rawLid.split(':')[0] + '@lid' : rawLid) : (botNum ? botNum + '@s.whatsapp.net' : undefined)

        let senderLidId = isFromMe
            ? botLid
            : Object.values(this.raw.key).find(v => typeof v === 'string' && v.endsWith('@lid')) || Object.values(this.raw.key).find(v => typeof v === 'string' && v.endsWith('@s.whatsapp.net')) || undefined

        let senderNumberId = Object.values(this.raw.key).find(v => typeof v === 'string' && v.endsWith('@s.whatsapp.net'))?.split('@')[0]
            || this.raw.key?.participant?.split('@')[0]
            || botNum
            || undefined

        this.sender = {
            id: senderLidId || (senderNumberId ? senderNumberId + '@s.whatsapp.net' : undefined),
            number: senderNumberId,
            mentioned: this.contextInfo?.mentionedJid ?? [],
            name: isFromMe ? (sock.user?.name || 'Bot') : this.raw.pushName || 'Usuario',
            user: '@' + (senderNumberId || senderLidId?.split('@')[0] || ''),
            roles: { root: false, owner: false, mod: false, vip: false, bot: false },
            get isAdmin() {
                if (!m.__groupMetaData) return false
                const myId = this.id || ''
                const myNum = this.number || myId.split('@')[0]?.split(':')[0]?.replace(/\D/g, '')
                const myLid = myId.includes('@lid') ? myId.split('@')[0]?.split(':')[0]?.replace(/\D/g, '') : null

                const admins = m.chat.admins || []

                const isMatch = (a) => {
                    if (!a) return false
                    if (a === myId) return true

                    const cleanA = a.split('@')[0]?.split(':')[0]?.replace(/\D/g, '')
                    if (!cleanA) return false

                    if (cleanA === myNum || (myLid && cleanA === myLid)) return true

                    const normA = cleanA.replace(/^521(\d{10})$/, '52$1').replace(/^549(\d{10})$/, '54$1')
                    const normMe = (myNum || '').replace(/^521(\d{10})$/, '52$1').replace(/^549(\d{10})$/, '54$1')
                    if (normA && normMe && normA === normMe) return true

                    if (myNum && myNum.length >= 8 && cleanA.length >= 8) {
                        return cleanA.endsWith(myNum.slice(-8)) || myNum.endsWith(cleanA.slice(-8))
                    }

                    return false
                }

                return admins.some(isMatch)
            }
        }

        Object.defineProperty(this.sender.roles, 'admin', {
            get: () => this.sender.isAdmin,
            enumerable: true
        })

        this.sender.getDesc = async () => await sock.fetchStatus(this.sender.id).then(r => r?.status || '').catch(() => '')
        this.sender.getPhoto = async () => await sock.profilePictureUrl(this.sender.id, 'image').catch(() => 'https://files.catbox.moe/obz4b4.jpg')

        this.sender.db = async () => {
            if (!global.db) return {}
            const users = await global.db.open('@users')
            if (!users[m.sender.id]) {
                users[m.sender.id] = {
                    name: m.sender.name,
                    banned: false,
                    roles: { root: false, owner: false, mod: false, vip: false }
                }
            }
            return users[m.sender.id]
        }

        if (global.db && this.sender.id) {
            try {
                const usersDB = await global.db.open('@users')
                usersDB[this.sender.id] ||= {
                    name: this.sender.name,
                    banned: false,
                    roles: { root: false, owner: false, mod: false, vip: false }
                }
                const userData = usersDB[this.sender.id]
                userData.roles ||= {}

                const plainNum = this.sender.number || this.sender.id?.split('@')[0]
                const configRoles = global.config?.userRoles?.[this.sender.id]
                    || global.config?.userRoles?.[plainNum]

                if (configRoles) {
                    Object.assign(userData.roles, configRoles)
                }

                Object.assign(this.sender.roles, userData.roles)
            } catch (e) {}
        }

        if (isFromMe || (this.bot?.id && this.sender.id === this.bot.id)) {
            Object.assign(this.sender.roles, { root: true, owner: true, mod: true, vip: true, bot: true })
        }

        this.sender.role = (...array) => array.some(role => this.sender.roles[role] === true)
    }
}