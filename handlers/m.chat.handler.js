// ./handlers/m.chat.handler.js
const groupMetaCache = new Map()
const GROUP_CACHE_TTL = 1000 * 60 * 5 // 5 minutos de cache en memoria

export default {
    enabled: true,
    priority: 0.05,
    script: async function ({ sock }) {
        const m = this
        const isGroup = (this.raw.key.remoteJid || '').endsWith('@g.us')
        const chatId = this.raw.key.remoteJid || this.raw.key.participant

        this.chat = {
            id: chatId,
            isGroup: isGroup,

            db: async () => {
                if (!global.db) return {}
                if (isGroup) {
                    return await global.db.open('@chat:' + chatId)
                } else {
                    const allUsers = await global.db.open('@users')
                    allUsers[chatId] ||= {}
                    return allUsers[chatId]
                }
            },

            async metaData() {
                if (!this.isGroup) return null
                if (m.__groupMetaData) return m.__groupMetaData

                const cached = groupMetaCache.get(this.id)
                if (cached && (Date.now() - cached.time < GROUP_CACHE_TTL)) {
                    m.__groupMetaData = cached.data
                    return m.__groupMetaData
                }

                try {
                    let res = null
                    if (typeof sock?.groupMetadata === 'function') {
                        res = await sock.groupMetadata(this.id).catch(() => null)
                    }
                    if (!res && typeof global.sock?.groupMetadata === 'function') {
                        res = await global.sock.groupMetadata(this.id).catch(() => null)
                    }

                    if (res && res.participants?.length) {
                        groupMetaCache.set(this.id, { data: res, time: Date.now() })
                        m.__groupMetaData = res

                        if (global.db) {
                            try {
                                const chatDB = await global.db.open('@chat:' + this.id)
                                chatDB.savedMetadata = res
                            } catch {}
                        }

                        return m.__groupMetaData
                    }
                } catch {}

                if (global.db) {
                    try {
                        const chatDB = await global.db.open('@chat:' + this.id)
                        if (chatDB?.savedMetadata) {
                            m.__groupMetaData = chatDB.savedMetadata
                            return m.__groupMetaData
                        }
                    } catch {}
                }

                m.__groupMetaData = cached?.data || null
                return m.__groupMetaData
            },

            get size() {
                if (!this.isGroup || !m.__groupMetaData) return 0
                return m.__groupMetaData.size || m.__groupMetaData.participants?.length || 0
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
                const adminList = this.participants.filter(o => ['admin', 'superadmin'].some(_ => _ === o.admin))
                const result = []
                for (const a of adminList) {
                    if (a.id) result.push(a.id)
                    if (a.jid) result.push(a.jid)
                    if (a.lid) result.push(a.lid)
                    if (a.phoneNumber) result.push(a.phoneNumber)
                }
                return [...new Set(result.filter(Boolean))]
            }
        }

        if (this.chat.isGroup) {
            await this.chat.metaData()

            Object.assign(this.chat, {
                add: async (user) => {
                    try { return await sock.groupParticipantsUpdate(this.chat.id, [user], 'add') } catch { return null }
                },
                remove: async (user) => {
                    try { return await sock.groupParticipantsUpdate(this.chat.id, [user], 'remove') } catch { return null }
                },
                promote: async (user) => {
                    try { return await sock.groupParticipantsUpdate(this.chat.id, [user], 'promote') } catch { return null }
                },
                demote: async (user) => {
                    try { return await sock.groupParticipantsUpdate(this.chat.id, [user], 'demote') } catch { return null }
                },
                getPhoto: async (type = 'image', id) => {
                    try {
                        return await sock.profilePictureUrl(id ?? this.chat.id, type)
                    } catch {
                        return 'https://files.catbox.moe/obz4b4.jpg'
                    }
                },
                setPhoto: async (image) => {
                    try { return await sock.updateProfilePicture(this.chat.id, image) } catch { return null }
                },
                setDesc: async (desc) => {
                    try { return await sock.groupUpdateDescription(this.chat.id, desc) } catch { return null }
                },
                setName: async (name) => {
                    try { return await sock.groupUpdateSubject(this.chat.id, name) } catch { return null }
                },
                getCodeInvite: async () => {
                    try { return await sock.groupInviteCode(this.chat.id) } catch { return '' }
                },
                getLinkInvite: async () => {
                    try { return `https://chat.whatsapp.com/${await sock.groupInviteCode(this.chat.id)}` } catch { return '' }
                },
                revoke: async () => {
                    try { return await sock.groupRevokeInvite(this.chat.id) } catch { return null }
                },
                settings: {
                    lock: async (bool) => {
                        try { return await sock.groupSettingUpdate(this.chat.id, bool ? 'locked' : 'unlocked') } catch { return null }
                    },
                    announce: async (bool) => {
                        try { return await sock.groupSettingUpdate(this.chat.id, bool ? 'announcement' : 'not_announcement') } catch { return null }
                    },
                    memberAdd: async (bool) => {
                        try { return await sock.groupSettingUpdate(this.chat.id, bool ? 'all_member_add' : 'admin_add') } catch { return null }
                    },
                    joinApproval: async (bool) => {
                        try { return await sock.groupJoinApprovalMode(this.chat.id, bool ? 'on' : 'off') } catch { return null }
                    }
                }
            })
        } else {
            this.chat.getDesc = async () => {
                try {
                    const r = await sock.fetchStatus(this.chat.id)
                    return r?.status || ''
                } catch { return '' }
            }
            this.chat.getPhoto = async () => {
                try {
                    return await sock.profilePictureUrl(this.chat.id, 'image')
                } catch {
                    return 'https://files.catbox.moe/obz4b4.jpg'
                }
            }
        }
    }
}