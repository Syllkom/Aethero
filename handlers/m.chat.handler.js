// ./handlers/m.chat.handler.js
export default {
    enabled: true,
    priority: 0.05,
    script: async function ({ sock }) {
        const m = this
        this.chat = {
            id: this.raw.key.remoteJid || this.raw.key.participant,
            isGroup: (this.raw.key.remoteJid || '').endsWith('@g.us'),

            async metaData() {
                if (!this.isGroup) return null
                if (m.__groupMetaData) return m.__groupMetaData
                m.__groupMetaData = await sock.groupMetadata(this.id).catch(() => null)
                return m.__groupMetaData
            },
            get size() {
                if (!this.isGroup || !m.__groupMetaData) return 0
                return m.__groupMetaData.size || 0
            },
            get desc() {
                if (!this.isGroup || !m.__groupMetaData) return ''
                return m.__groupMetaData.desc || ''
            },
            get name() {
                if (!this.isGroup || !m.__groupMetaData) return ''
                return m.__groupMetaData.subject || ''
            },
            get created() {
                if (!this.isGroup || !m.__groupMetaData) return 0
                return m.__groupMetaData.creation || 0
            },
            get participants() {
                if (!this.isGroup || !m.__groupMetaData) return []
                return m.__groupMetaData.participants || []
            },
            get owner() {
                if (!this.isGroup || !m.__groupMetaData) return ''
                return m.__groupMetaData.owner || m.__groupMetaData.subjectOwner || ''
            },
            get admins() {
                if (!this.isGroup || !m.__groupMetaData) return []
                const admins = this.participants.filter(o => ['admin', 'superadmin'].some(_ => _ === o.admin))
                return admins.map(v => v.jid ?? v.id) || []
            }
        }

        if (this.chat.isGroup) {
            await this.chat.metaData()

            Object.assign(this.chat, {
                add: async (user) => await sock.groupParticipantsUpdate(this.chat.id, [user], 'add'),
                remove: async (user) => await sock.groupParticipantsUpdate(this.chat.id, [user], 'remove'),
                promote: async (user) => await sock.groupParticipantsUpdate(this.chat.id, [user], 'promote'),
                demote: async (user) => await sock.groupParticipantsUpdate(this.chat.id, [user], 'demote'),
                getPhoto: async (type = 'image', id) => await sock.profilePictureUrl(id ?? this.chat.id, type).catch(() => 'https://files.catbox.moe/obz4b4.jpg'),
                setPhoto: async (image) => await sock.updateProfilePicture(this.chat.id, image),
                setDesc: async (desc) => await sock.groupUpdateDescription(this.chat.id, desc),
                setName: async (name) => await sock.groupUpdateSubject(this.chat.id, name),
                getCodeInvite: async () => await sock.groupInviteCode(this.chat.id),
                getLinkInvite: async () => `https://chat.whatsapp.com/${await sock.groupInviteCode(this.chat.id)}`,
                revoke: async () => await sock.groupRevokeInvite(this.chat.id),
                settings: {
                    lock: async (bool) => await sock.groupSettingUpdate(this.chat.id, bool ? 'locked' : 'unlocked'),
                    announce: async (bool) => await sock.groupSettingUpdate(this.chat.id, bool ? 'announcement' : 'not_announcement'),
                    memberAdd: async (bool) => await sock.groupSettingUpdate(this.chat.id, bool ? 'all_member_add' : 'admin_add'),
                    joinApproval: async (bool) => await sock.groupJoinApprovalMode(this.chat.id, bool ? 'on' : 'off'),
                },
                db: async () => global.db ? await global.db.open('@chat:' + this.chat.id) : {}
            })
        } else {
            this.chat.getDesc = async () => await sock.fetchStatus(this.chat.id).then(r => r?.status || '').catch(() => '')
            this.chat.getPhoto = async () => await sock.profilePictureUrl(this.chat.id, 'image').catch(() => 'https://files.catbox.moe/obz4b4.jpg')
            this.chat.db = async () => {
                if (!global.db) return {}
                const allUsers = await global.db.open('@users')
                return allUsers[this.chat.id] || {}
            }
        }
    }
}