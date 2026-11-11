// ./plugins/owner/mode.plugin.js

export default {
    command: true, usePrefix: true,
    before: true, priority: 1,
    case: ['publico', 'public', 'privado', 'private'],
    category: 'owner', description: 'Alterna entre modo publico y privado de forma aislada por sesion.',
    usage: ['public', 'private'],
    script: async (m, { sock, control }) => {
        const rawBotId = m.bot?.id || sock.user?.id || ''
        
        const botKey = rawBotId.split('@')[0].split(':')[0].replace(/\D/g, '') || 'main'

        if (control) {
            const rawText = (m.content?.text || '').trim()
            const prefixes = global.config?.prefixes || '.¿?¡!#%&/,~@'
            const isCommand = Boolean(rawText && prefixes.includes(rawText[0]))

            if (isCommand) {
                const settings = await global.db.open('@bot_settings:' + botKey)
                const isPrivate = Boolean(settings.privateMode)

                if (isPrivate && !m.sender.role('root', 'owner', 'bot')) {
                    control.end = true
                }
            }
            return
        }

        if (!m.sender.role('root', 'owner', 'bot')) return m.sms('owner')

        const settings = await global.db.open('@bot_settings:' + botKey)
        const isPrivateCmd = ['privado', 'private'].includes(m.command)

        if (isPrivateCmd) {
            if (settings.privateMode) return m.reply(`[!] Este bot (+${botKey}) ya se encuentra en modo privado.`)
            settings.privateMode = true
            await m.reply(`Modo Privado Activado (+${botKey})\n\n[!] Ahora solo los propietarios pueden utilizar los comandos de este bot.`)
        } else {
            if (!settings.privateMode) return m.reply(`[!] Este bot (+${botKey}) ya se encuentra en modo publico.`)
            settings.privateMode = false
            await m.reply(`Modo Publico Activado (+${botKey})\n\n[!] Todos los usuarios pueden utilizar los comandos de este bot.`)
        }

        await m.react('done')
    }
}