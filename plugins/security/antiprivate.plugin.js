// ./plugins/security/antiprivate.plugin.js
export default {
    command: true, usePrefix: true,
    before: true, priority: 2,
    case: ['antiprivado', 'antiprivate', 'antidm'],
    category: 'security',
    description: 'Bloquea nuevos chats privados a nivel de cuenta sin afectar chats previos.',
    usage: ['antiprivado on', 'antiprivado off', 'antiprivado status'],
    script: async (m, { sock, control }) => {
        if (!m.chat.isGroup && !m.bot?.fromMe && !m.raw?.key?.fromMe) {
            const configDB = await global.db.open('@config:security')
            const isAntiPrivateActive = configDB.antiPrivate ?? false

            if (isAntiPrivateActive) {
                const isPrivileged = m.sender.role('root', 'owner', 'mod', 'vip')

                if (!isPrivileged) {
                    const antiPrivateDB = await global.db.open('@antiprivate')
                    const chatJid = m.chat.id

                    if (antiPrivateDB[chatJid]?.allowed) {
                        return
                    }

                    const chatIndex = await global.db.open('@history/' + chatJid)
                    const msgCount = Object.keys(chatIndex || {}).filter(k => !k.endsWith('_alt')).length

                    if (msgCount > 1) {
                        antiPrivateDB[chatJid] = { allowed: true, date: Date.now() }
                        return
                    }

                    if (control) control.end = true

                    const warningText = [
                        '✦ *ACCESO RESTRINGIDO* ╵ _Anti-Privado_',
                        '',
                        '- El contacto por chat privado no esta autorizado.',
                        '- Tu numero ha sido bloqueado en esta cuenta de WhatsApp.',
                        '- Para comunicarte o usar el bot, unete a los grupos oficiales.',
                        '',
                        '_Aethero Security Engine_'
                    ].join('\n')

                    await m.reply(warningText)

                    let rawPhone = m.sender?.number || ''
                    if (!rawPhone && chatJid.endsWith('@s.whatsapp.net')) {
                        rawPhone = chatJid.split('@')[0].split(':')[0].replace(/\D/g, '')
                    }
                    if (!rawPhone && m.sender?.id?.endsWith('@s.whatsapp.net')) {
                        rawPhone = m.sender.id.split('@')[0].split(':')[0].replace(/\D/g, '')
                    }

                    const targetBlockJid = rawPhone ? `${rawPhone}@s.whatsapp.net` : chatJid

                    await new Promise(resolve => setTimeout(resolve, 1500))

                    try {
                        await sock.updateBlockStatus(targetBlockJid, 'block')
                    } catch (err) {
                        console.error('[AntiPrivate Error]: No se pudo bloquear a', targetBlockJid, err.message)
                    }

                    return
                }
            }
        }

        if (m.command === undefined) return

        if (!m.sender.role('root', 'owner')) {
            return m.sms('owner')
        }

        const configDB = await global.db.open('@config:security')
        const action = (m.args[0] || '').toLowerCase()

        if (['on', 'enable', 'activar', '1'].includes(action)) {
            configDB.antiPrivate = true
            return m.reply('✦ Anti-Privado activado. Los nuevos chats seran advertidos y bloqueados en WhatsApp.')
        }

        if (['off', 'disable', 'desactivar', '0'].includes(action)) {
            configDB.antiPrivate = false
            return m.reply('✦ Anti-Privado desactivado. Se permite la entrada de nuevos chats.')
        }

        const estado = configDB.antiPrivate ? 'Activado' : 'Desactivado'
        return m.reply(`✦ Estado de Anti-Privado: *${estado}*\n\n- Comandos disponibles:\n╵ .antiprivado on (Activar bloqueo)\n╵ .antiprivado off (Desactivar bloqueo)`)
    }
}