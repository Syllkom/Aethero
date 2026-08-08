// ./handlers/m.sender.handler.js
export default {
    enabled: true,
    priority: 0.12,
    script: async function ({ sock }) {
        const m = this
        const isFromMe = !!this.raw.key.fromMe

        let senderLidId = isFromMe
            ? (sock.user.lid.includes(':') ? sock.user.lid.split(':')[0] + '@lid' : sock.user.lid)
            : Object.values(this.raw.key).find(v => typeof v === 'string' && v.endsWith('@lid')) || undefined

        let senderNumberId = Object.values(this.raw.key).find(v => typeof v === 'string' && v.endsWith('@s.whatsapp.net'))?.split('@')[0]
            || sock.user?.id?.split(':')[0] || undefined

        this.sender = {
            id: senderLidId,
            number: senderNumberId,
            mentioned: this.contextInfo?.mentionedJid ?? [],
            name: isFromMe ? (sock.user.name || 'Bot') : this.raw.pushName || 'Usuario',
            user: '@' + (senderLidId?.split('@')[0] || ''),
            roles: { root: false, owner: false, mod: false, vip: false, bot: false },
            get isAdmin() {
                if (!m.__groupMetaData) return
                return m.chat.admins?.includes(this.id) || false
            }
        }

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
            } catch (e) {
                console.error('[Sender DB Roles Error]:', e)
            }
        }

        if (isFromMe || (this.bot?.id && this.sender.id === this.bot.id)) {
            Object.assign(this.sender.roles, { root: true, owner: true, mod: true, vip: true, bot: true })
        }

        this.sender.role = (...array) => array.some(role => this.sender.roles[role] === true)
    }
}