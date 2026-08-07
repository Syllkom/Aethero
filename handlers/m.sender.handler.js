export default {
    enabled: true,
    priority: 0.12,
    script: async function () {
        let senderLidId = this.bot?.fromMe ? this.bot.id : Object.values(this.raw
            .key).find(value => typeof value === 'string' && value.endsWith('@lid')) || undefined
        let senderNumberId = Object.values(this.raw.key).find(value => typeof value
            === 'string' && value.endsWith('@s.whatsapp.net'))?.split('@')[0] || undefined
        const m = this

        this.sender = {
            id: senderLidId,
            number: senderNumberId,
            mentioned: this.contextInfo?.mentionedJid ?? [],
            name: this.bot?.fromMe ? this.bot.name : this.raw.pushName || '',
            user: '@' + senderLidId?.split('@')[0] || undefined,
            get isAdmin() {
                if (!m.__groupMetaData) return
                return m.chat.admins?.includes(this.id) || false
            }
        }
    }
}