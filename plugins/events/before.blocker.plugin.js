// ./plugins/events/before.blocker.plugin.js
export default {
    before: true,
    priority: 3,
    script: async (m, { control }) => {
        if (!m.isCmd || !m.plugin) return

        const dbTarget = await m.chat.db()
        const disabledCats = dbTarget?.settings?.disabledCats || []

        if (disabledCats.length === 0) return

        const p = m.plugin
        const targetCats = new Set()

        if (p.category) {
            const legacy = Array.isArray(p.category) ? p.category : [p.category]
            legacy.forEach(c => targetCats.add(c.toLowerCase()))
        }

        if (p.list) {
            const list = Array.isArray(p.list) ? p.list : [p.list]
            list.forEach(l => {
                if (l.category) targetCats.add(l.category.toLowerCase())
                if (l.cat) targetCats.add(l.cat.toLowerCase())
            })
        }

        const isBlocked = Array.from(targetCats).some(c => disabledCats.includes(c))

        if (isBlocked) {
            control.end = true
            await m.react('error')
            await m.reply(`ⓘ Los comandos de la categoría *${Array.from(targetCats).join(', ').toUpperCase()}* están desactivados en este chat.`)
        }
    }
}