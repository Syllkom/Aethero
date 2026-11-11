// ./plugins/events/before.soloadmin.plugin.js

export default {
    before: true, priority: 3,
    script: async (m, { control }) => {
        if (!m.chat?.isGroup) return
        if (m.bot?.fromMe || m.raw?.key?.fromMe) return

        const rawText = (m.content?.text || '').trim()
        if (!rawText) return

        const prefixes = global.config?.prefixes || '.¿?¡!#%&/,~@'
        const isCommand = Boolean(prefixes.includes(rawText[0]))
        if (!isCommand) return

        const chat = await m.chat.db()
        const isSoloAdmin = Boolean(chat?.settings?.soloadmin)
        if (!isSoloAdmin) return

        if (m.sender.role('owner', 'root', 'bot')) return

        if (!m.__groupMetaData) {
            await m.chat.metaData()
        }

        if (m.sender.isAdmin) return

        const senderId = m.sender.id || ''
        const senderNum = m.sender.number || senderId.split('@')[0]?.split(':')[0]?.replace(/\D/g, '')
        const senderLid = senderId.includes('@lid') ? senderId.split('@')[0]?.split(':')[0]?.replace(/\D/g, '') : null

        const admins = m.chat.admins || []
        const isDirectAdmin = admins.some(a => {
            if (!a) return false
            if (a === senderId) return true

            const cleanA = a.split('@')[0]?.split(':')[0]?.replace(/\D/g, '')
            if (!cleanA) return false

            if (cleanA === senderNum || (senderLid && cleanA === senderLid)) return true

            const normA = cleanA.replace(/^521(\d{10})$/, '52$1').replace(/^549(\d{10})$/, '54$1')
            const normSender = (senderNum || '').replace(/^521(\d{10})$/, '52$1').replace(/^549(\d{10})$/, '54$1')
            if (normA && normSender && normA === normSender) return true

            if (senderNum && senderNum.length >= 8 && cleanA.length >= 8) {
                return cleanA.endsWith(senderNum.slice(-8)) || senderNum.endsWith(cleanA.slice(-8))
            }

            return false
        })

        if (isDirectAdmin) return

        if (control) control.end = true
        return // m.reply('[!] En este grupo el bot solo puede ser utilizado por administradores.')
    }
}