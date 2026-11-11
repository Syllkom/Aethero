// ./handlers/m.reaction.handler.js
export default {
    enabled: true,
    priority: 0.13,
    script: async function ({ sock, control, modules }) {
        const m = this

        if (m.type !== 'reactionMessage') return

        const { text: emoji, key: targetKey } = m.messageData || {}
        if (!emoji || !targetKey?.id) return

        const systemEmojis = ['⌛', '✔️', '✖️', '✅', '❌']
        if (systemEmojis.includes(emoji)) return

        const senderJid = m.sender?.id || m.raw?.key?.participant || m.raw?.key?.remoteJid
        const userKey = senderJid.split('@')[0].split(':')[0]

        const plugins = modules.getFolder('plugins')
        const reactPlugins = plugins.query({ reaction: emoji })
            .concat(plugins.query({ reaction: '*' }))

        if (!reactPlugins || reactPlugins.length === 0) return

        for (const plugin of reactPlugins) {
            if (control.end) break

            const isGlobal = plugin.dbScope === 'global'
            const dbName = plugin.dbName || '@plugins_db'
            const finalDbKey = isGlobal ? dbName : `${dbName}:${userKey}`
            
            const db = await global.db.open(finalDbKey)
            
            try {
                await plugin.script(m, { sock, control, modules, targetKey, emoji, userKey, db })
            } catch (e) {
                console.error(`[Reaction Error] en plugin ${plugin.fileName}:`, e.message)
            }
        }

        control.end = true
    }
}