// ./plugins/owner/botconfig.plugin.js

function resolveTargetNumber(m, argIndex = 2) {
    if (m.quoted?.sender?.number) return m.quoted.sender.number.replace(/\D/g, '')
    if (m.quoted?.key?.participant) return m.quoted.key.participant.split('@')[0].replace(/\D/g, '')
    if (m.sender.mentioned && m.sender.mentioned.length > 0) {
        return m.sender.mentioned[0].split('@')[0].replace(/\D/g, '')
    }
    if (m.args[argIndex]) {
        const raw = m.args[argIndex].replace(/\D/g, '')
        if (raw.length >= 7) return raw
    }
    if (!m.chat.isGroup && m.chat.id.endsWith('@s.whatsapp.net')) {
        return m.chat.id.split('@')[0].replace(/\D/g, '')
    }
    return null
}

export default {
    before: true, priority: 1,
    command: true, usePrefix: true,
    case: ['botconfig', 'bconfig'],
    description: 'Configura auto-lectura, notificaciones, anti-llamadas y el modo privado/público del bot.',
    category: 'owner',
    usage: [
        'bconfig mode public/private',
        'bconfig private on/off',
        'bconfig autoread global on/off', 
        'bconfig notify on/off', 
        'bconfig anticall on/off', 
        'bconfig anticall add/del/list'
    ],
    script: async (m, { sock, control }) => {
        if (m.botConfigHandled) return

        if (global.db) {
            try {
                const botConfig = await global.db.open('@bot_config')
                const chatConfig = await global.db.open('@chat_config')

                if (botConfig.privateMode !== undefined) global.config.privateMode = botConfig.privateMode
                if (botConfig.antiCall !== undefined) global.config.antiCall = botConfig.antiCall
                if (Array.isArray(botConfig.antiCallWhitelist)) global.config.antiCallWhitelist = botConfig.antiCallWhitelist

                if (global.config.privateMode === true) {
                    const isAuthorized = m.sender.role('root', 'owner') || m.sender.roles.bot || m.bot?.fromMe || m.raw?.key?.fromMe
                    if (!isAuthorized) {
                        if (control) control.end = true
                        return
                    }
                }

                if (!m.sender.roles.bot) {
                    const isGlobalRead = botConfig.autoRead === true
                    const isChatRead = chatConfig[m.chat.id]?.autoRead === true

                    if (isGlobalRead || isChatRead) {
                        await sock.readMessages([m.raw.key])
                    }
                }
            } catch (e) {
                console.error('[BotConfig Sync Error]', e.message)
            }
        }
        
        if (m.isCmd && ['botconfig', 'bconfig'].includes(m.command)) {
            m.botConfigHandled = true

            if (!m.sender.role('root', 'owner')) {
                return m.reply('ⓘ Este comando es exclusivo para los propietarios de este bot.')
            }

            const option = m.args[0]?.toLowerCase()

            if (['mode', 'modo', 'private', 'privado', 'self'].includes(option)) {
                let sub = m.args[1]?.toLowerCase()
                
                if (option === 'private' || option === 'privado' || option === 'self') {
                    sub = m.args[0] ? (m.args[1]?.toLowerCase() || 'toggle') : 'toggle'
                }

                const isEnable = ['on', 'private', 'privado', 'self', 'true'].includes(sub)
                const isDisable = ['off', 'public', 'publico', 'público', 'false'].includes(sub)

                if (!isEnable && !isDisable) {
                    return m.reply('ⓘ Uso correcto:\n- _.bconfig mode public/private_\n- _.bconfig private on/off_')
                }

                const finalState = isEnable
                const botConfig = await global.db.open('@bot_config')
                botConfig.privateMode = finalState
                global.config.privateMode = finalState

                return m.reply(
                    finalState
                        ? '🔒 *MODO PRIVADO ACTIVADO*\nAhora el bot solo responderá a los propietarios (Root/Owner) y a sí mismo.'
                        : '🌐 *MODO PÚBLICO ACTIVADO*\nAhora todos los usuarios pueden usar los comandos del bot libremente.'
                )
            }

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

            if (option === 'anticall' || option === 'call') {
                const sub = m.args[1]?.toLowerCase()
                const botConfig = await global.db.open('@bot_config')
                botConfig.antiCallWhitelist ||= global.config?.antiCallWhitelist || []

                if (sub === 'on' || sub === 'off') {
                    const isEnable = sub === 'on'
                    botConfig.antiCall = isEnable
                    global.config.antiCall = isEnable

                    return m.reply(`✓ Auto-Rechazo de llamadas (AntiCall) establecido en: *${isEnable ? 'ACTIVADO' : 'DESACTIVADO'}*.\n${isEnable ? 'ⓘ Las llamadas de números no autorizados serán cortadas automáticamente.' : 'ⓘ Todas las llamadas timbrarán normalmente en tu teléfono.'}`)
                }

                if (['add', 'allow', 'permitir', 'whitelist'].includes(sub)) {
                    const targetNum = resolveTargetNumber(m, 2)
                    if (!targetNum) {
                        return m.reply('ⓘ Cita el mensaje del usuario, menciónalo o escribe su número.\n- Ejemplo: _.bconfig anticall add 51932485515_\n- O responde al mensaje con: _.bconfig anticall add_')
                    }

                    if (!botConfig.antiCallWhitelist.includes(targetNum)) {
                        botConfig.antiCallWhitelist.push(targetNum)
                    }
                    global.config.antiCallWhitelist = botConfig.antiCallWhitelist

                    return m.reply(`✓ El número *+${targetNum}* fue añadido a la lista blanca.\nAhora sus llamadas timbrarán libremente en tu teléfono sin ser cortadas.`)
                }

                if (['del', 'delete', 'remove', 'quitar', 'bloquear'].includes(sub)) {
                    const targetNum = resolveTargetNumber(m, 2)
                    if (!targetNum) {
                        return m.reply('ⓘ Cita el mensaje del usuario, menciónalo o escribe su número para eliminarlo de la lista blanca.')
                    }

                    botConfig.antiCallWhitelist = botConfig.antiCallWhitelist.filter(num => num !== targetNum)
                    global.config.antiCallWhitelist = botConfig.antiCallWhitelist

                    return m.reply(`🗑️ El número *+${targetNum}* fue eliminado de la lista blanca de llamadas.`)
                }

                if (['list', 'ver', 'ls'].includes(sub)) {
                    const list = botConfig.antiCallWhitelist
                    if (!list || !list.length) {
                        return m.reply(`✆ *Lista Blanca de Llamadas*\n\nⓘ No hay números autorizados registrados.\nEstado AntiCall: *${global.config.antiCall ? 'ACTIVADO' : 'DESACTIVADO'}*`)
                    }

                    const formattedList = list.map((num, i) => `${i + 1}. +${num}`).join('\n')
                    return m.reply(`✆ *Números autorizados para llamar (${list.length}):*\n\n${formattedList}\n\nⓘ Estado AntiCall: *${global.config.antiCall ? 'ACTIVADO' : 'DESACTIVADO'}*`)
                }

                return m.reply(
                    `╭○ *Ajustes de Anti-Llamadas (AntiCall)*\n` +
                    `╵ ✦ _.bconfig anticall on/off_ — Activa o desactiva el auto-corte\n` +
                    `╵ ✦ _.bconfig anticall add [número/citar]_ — Permite que alguien te llame\n` +
                    `╵ ✦ _.bconfig anticall del [número/citar]_ — Quita a alguien de la lista\n` +
                    `╵ ✦ _.bconfig anticall list_ — Ver números autorizados\n` +
                    `╰╶╴──────╶╴─╶╴◯`
                )
            }

            return m.reply(
                `╭○ *Configuración de Instancia (Aethero)*\n\n` +
                `— *Modo de Acceso:*\n` +
                `╵ ✧ _.bconfig mode public/private_\n` +
                `╵ ✧ _.bconfig private on/off_\n\n` +
                `— *Auto-Lectura de Mensajes:*\n` +
                `╵ ✧ _.bconfig autoread global on/off_ (Todos los chats)\n` +
                `╵ ✧ _.bconfig autoread chat on/off_ (Este chat únicamente)\n\n` +
                `— *Notificación de Inicio:*\n` +
                `╵ ✧ _.bconfig notify on/off_\n\n` +
                `— *Gestión de Llamadas (AntiCall):*\n` +
                `╵ ✧ _.bconfig anticall on/off_\n` +
                `╵ ✧ _.bconfig anticall add/del/list [número/citar]_\n` +
                `╰╶╴──────╶╴─╶╴◯`
            )
        }
    }
}