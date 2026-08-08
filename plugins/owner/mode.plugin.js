// ./plugins/owner/mode.plugin.js
export default {
    before: true, priority: 1,
    command: true, usePrefix: true,
    case: ['publico', 'public', 'privado', 'private'],
    description: 'Alterna entre modo público y privado controlando el acceso a comandos.',
    category: 'owner',
    usage: 'public / private',
    script: async (m, { control }) => {
        if (control) {
            const text = m.content?.text?.trim() || ''
            const prefixes = global.config.prefixes
            const isCommandText = prefixes && prefixes.includes(text[0])

            if (isCommandText) {
                const settings = await global.db.open('@bot_settings')
                const isPrivate = settings.privateMode || false

                if (isPrivate && !m.sender.role('root', 'owner', 'bot')) {
                    control.end = true
                }
            }
            return
        }

        if (!m.sender.role('root', 'owner', 'bot')) return m.sms('owner')

        const settings = await global.db.open('@bot_settings')
        const isPrivateCmd = ['privado', 'private'].includes(m.command)

        if (isPrivateCmd) {
            if (settings.privateMode) return m.reply('ⓘ El bot ya se encuentra en modo privado.')
            settings.privateMode = true
            await m.reply('✓ *Modo Privado Activado*\nⓘ Ahora solo los propietarios pueden utilizar mis comandos.')
        } else {
            if (!settings.privateMode) return m.reply('ⓘ El bot ya se encuentra en modo público.')
            settings.privateMode = false
            await m.reply('✓ *Modo Público Activado*\nⓘ Todos los usuarios pueden utilizar mis comandos.')
        }

        await m.react('done')
    }
}