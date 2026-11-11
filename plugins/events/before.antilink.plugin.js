// ./plugins/events/before.antilink.plugin.js
const LINK_REGEX = /chat\.whatsapp\.com\/[A-Za-z0-9]{20,}/i

export default {
    before: true,
    priority: 2,
    async script(m, { control, sock }) {
        if (!m.chat.isGroup || m.bot.fromMe) return

        const text = m.content?.text || ''
        const hasLink = LINK_REGEX.test(text)

        if (hasLink) {
            const chat = await m.chat.db()
            const settings = chat?.settings || {}

            if (!settings.antilink) return

            const isImmune = m.sender.role('admin', 'owner', 'root')
            if (isImmune) return

            if (!m.bot.roles.admin) {
                return m.reply('Enlace detectado. Necesito ser admin para eliminar/sancionar.')
            }

            const mode = settings.antilinkMode || 'kick'
            await sock.sendMessage(m.chat.id, { delete: m.raw.key })

            if (mode === 'delete') {
                await m.reply(`@${m.sender.number} enlace eliminado. Prohibido enviar links.`)
            } else if (mode === 'kick') {
                await m.reply(`Enlace detectado. Eliminando a @${m.sender.number}.`)
                await m.chat.remove(m.sender.id)
            } else if (mode === 'warn') {
                chat.users ||= {}
                chat.users[m.sender.id] ||= { warns: 0 }
                chat.users[m.sender.id].warns += 1
                const warns = chat.users[m.sender.id].warns

                if (warns >= 3) {
                    chat.users[m.sender.id].warns = 0
                    await m.reply(`@${m.sender.number} ha alcanzado 3/3 advertencias. Eliminado.`)
                    await m.chat.remove(m.sender.id)
                } else {
                    await m.reply(`Advertencia para @${m.sender.number}.\nEnlaces prohibidos.\nStrike: ${warns}/3`)
                }
            }

            control.end = true
        }
    }
}