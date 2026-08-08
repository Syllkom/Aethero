// ./plugins/owner/botconfig.plugin.js
export default {
    before: true, priority: 1,
    command: true, usePrefix: true,
    case: ['botconfig', 'bconfig'],
    description: 'Configura la auto-lectura de mensajes y la notificación de inicio de forma aislada.',
    category: 'owner',
    usage: ['bconfig autoread global on/off', 'bconfig autoread chat on/off', 'bconfig notify on/off'],
    script: async (m, { sock }) => {
        if (m.botConfigHandled) return

        if (!m.sender.roles.bot && global.db) {
            try {
                const botConfig = await global.db.open('@bot_config')
                const chatConfig = await global.db.open('@chat_config')

                const isGlobalRead = botConfig.autoRead === true
                const isChatRead = chatConfig[m.chat.id]?.autoRead === true

                if (isGlobalRead || isChatRead) {
                    await sock.readMessages([m.raw.key])
                }
            } catch (e) {
                console.error('[AutoRead Error]', e.message)
            }
        }

        if (m.isCmd && ['botconfig', 'bconfig'].includes(m.command)) {
            m.botConfigHandled = true

            if (!m.sender.role('root', 'owner')) {
                return m.reply('ⓘ Este comando es exclusivo para los propietarios de este bot.')
            }

            const option = m.args[0]?.toLowerCase()

            if (option === 'notify') {
                const mode = m.args[1]?.toLowerCase()
                if (!['on', 'off'].includes(mode)) {
                    return m.reply('ⓘ Uso correcto: .bconfig notify on/off')
                }

                const isEnable = mode === 'on'
                const botConfig = await global.db.open('@bot_config')
                botConfig.startupNotification = isEnable
                global.config.startupNotification = isEnable

                return m.reply(`✓ Notificación de encendido establecida en: *${isEnable ? 'ACTIVADO' : 'DESACTIVADO'}* para este bot.`)
            }

            if (option === 'autoread') {
                const scope = m.args[1]?.toLowerCase()
                const mode = m.args[2]?.toLowerCase()

                if (!['global', 'chat'].includes(scope) || !['on', 'off'].includes(mode)) {
                    return m.reply('ⓘ Uso correcto:\n- _.bconfig autoread global on/off_\n- _.bconfig autoread chat on/off_')
                }

                const isEnable = mode === 'on'
                const botConfig = await global.db.open('@bot_config')
                const chatConfig = await global.db.open('@chat_config')

                if (scope === 'global') {
                    botConfig.autoRead = isEnable
                    return m.reply(`✓ Auto-Lectura GLOBAL establecida en: *${isEnable ? 'ACTIVADO' : 'DESACTIVADO'}* para este bot.`)
                }

                if (scope === 'chat') {
                    chatConfig[m.chat.id] ||= {}
                    chatConfig[m.chat.id].autoRead = isEnable
                    return m.reply(`✓ Auto-Lectura para ESTE CHAT establecida en: *${isEnable ? 'ACTIVADO' : 'DESACTIVADO'}* en este bot.`)
                }
            }

            return m.reply(
                `▢ *Configuración de Instancia*\n\n` +
                `- _.bconfig autoread global on/off_ — Auto-lectura de todos los chats\n` +
                `- _.bconfig autoread chat on/off_ — Auto-lectura de este chat únicamente\n` +
                `- _.bconfig notify on/off_ — Notificación de encendido al root`
            )
        }
    }
}