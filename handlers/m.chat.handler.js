export default {
    enabled: true,
    priority: 0.11,
    script: async function () {
        const m = this
        this.chat = {
            id: this.raw.key.remoteJid || this.raw.key.participant,
            isGroup: this.raw.key.remoteJid.endsWith('@g.us'),

            async metaData() {
                if (!this.isGroup) return
                if (m.__groupMetaData) return m.__groupMetaData
                m.__groupMetaData = await m.sock.groupMetadata(this.id)
                return m.__groupMetaData
            },
            get size() {
                if (!this.isGroup) return
                if (!m.__groupMetaData) return
                return m.__groupMetaData.size || 0
            },
            get desc() {
                if (!this.isGroup) return
                if (!m.__groupMetaData) return
                return m.__groupMetaData.desc || ''
            },
            get name() {
                if (!this.isGroup) return
                if (!m.__groupMetaData) return
                return m.__groupMetaData.subject || ''
            },
            get created() {
                if (!this.isGroup) return
                if (!m.__groupMetaData) return
                return m.__groupMetaData.creation || 0
            },
            get participants() {
                if (!this.isGroup) return
                if (!m.__groupMetaData) return
                return m.__groupMetaData.participants || []
            },
            get owner() {
                if (!this.isGroup) return
                if (!m.__groupMetaData) return
                return m.__groupMetaData.owner
                    || m.__groupMetaData.subjectOwner
            },
            get admins() {
                if (!this.isGroup) return
                if (!m.__groupMetaData) return
                const admins = this.participants.filter(o =>
                    ['admin', 'superadmin'].some(_ => _ === o.admin))
                return admins.map(v => v.jid ?? v.id) || []
            }
        }
    }
}