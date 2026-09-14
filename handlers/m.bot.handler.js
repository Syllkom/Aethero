export default {
    enabled: true,
    priority: 0.1,
    script: async function ({ sock }) {
        const m = this

        const botNum = sock.user?.id?.split(':')[0]
        const botLid = sock.user?.lid?.split(':')[0]

        this.bot = {
            get isAdmin() {
                if (!m.chat?.isGroup || !m.chat?.admins) return false
                return m.chat.admins.some(a => (botNum && a.includes(botNum)) || (botLid && a.includes(botLid)))
            }
        }

        const rawLid = sock.user?.lid || ''
        this.bot.id = rawLid ? (rawLid.includes(':') ? (rawLid.split(':')[0] + '@lid') : rawLid) : (botNum ? botNum + '@s.whatsapp.net' : '')
        this.bot.user = '@' + (this.bot.id?.split('@')[0] || '')
        this.bot.number = botNum || undefined
        this.bot.name = sock.user?.name || ''
        this.bot.fromMe = this.raw.key.fromMe

        const isBotAdmin = this.bot.isAdmin
        this.bot.roles = { root: true, owner: true, mod: true, vip: true, admin: isBotAdmin }

        this.bot.getDesc = async () => await sock.fetchStatus(this.bot.id).then(r => r?.status || '').catch(() => '')
        this.bot.getPhoto = async () => await sock.profilePictureUrl(this.bot.id, 'image').catch(() => 'https://files.catbox.moe/obz4b4.jpg')
        this.bot.setPhoto = async (image) => await sock.updateProfilePicture(this.bot.id, image)
        this.bot.setDesc = async (desc) => await sock.updateProfileStatus(desc)
        this.bot.setName = async (name) => await sock.updateProfileName(name)
        this.bot.join = async (link) => await sock.groupAcceptInvite(link)
        this.bot.mute = async (id, Boolean, time = 1000 * 60 * 60 * 8) => {
            if (Boolean) await sock.chatModify({ mute: time }, id, [])
            else await sock.chatModify({ mute: null }, id, [])
        }
        this.bot.block = async (id, Boolean) => {
            if (Boolean) await sock.updateBlockStatus(id, 'block')
            else await sock.updateBlockStatus(id, 'unblock')
        }
        this.bot.role = (...array) => array.some(role => this.bot.roles[role] === true)
    }
}