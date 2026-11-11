// ./plugins/main/subbot.plugin.js

const BANNER_URL = 'https://files.catbox.moe/0pevpc.png'

const formatUptime = (ms) => {
    if (!ms) return '0s'
    const s = Math.floor(ms / 1000)
    const d = Math.floor(s / 86400)
    const h = Math.floor((s % 86400) / 3600)
    const m = Math.floor((s % 3600) / 60)
    return `${d > 0 ? d + 'd ' : ''}${h > 0 ? h + 'h ' : ''}${m}m`
}

export default {
    command: true, usePrefix: true,
    before: true, priority: 1,
    case: ['subbot', 'jadibot', 'serbot'],
    category: 'main',
    description: 'Gestion, vinculacion y control de Sub-Bots.',
    usage: ['subbot', 'subbot ‹numero›', 'subbot list', 'subbot stop', 'subbot off', 'subbot on'],
    script: async (m, { sock, control }) => {
        if (m.chat?.isGroup && sock.isSubbot) {
            const chatDB = await m.chat.db()
            if (chatDB.subbotDisabled) {
                const rawText = (m.content?.text || '').trim()
                const prefixes = global.config?.prefixes || '.¿?¡!#%&/,~@'
                const hasPrefix = Boolean(rawText && prefixes.includes(rawText[0]))
                const clean = hasPrefix ? rawText.slice(1).trim() : rawText
                const cmd = clean.split(/\s+/)[0]?.toLowerCase() || ''
                const act = clean.split(/\s+/)[1]?.toLowerCase() || ''

                const isReactivating = hasPrefix &&
                    ['subbot', 'jadibot', 'serbot'].includes(cmd) &&
                    ['on', 'enable', 'activar'].includes(act) &&
                    (m.sender.isAdmin || m.sender.role('root', 'owner'))

                if (!isReactivating) {
                    if (control) control.end = true
                    return
                }
            }
        }

        if (m.command === undefined) return

        if (!global.subbots) {
            return m.reply('[!] El gestor de Sub-Bots no esta disponible en este momento.')
        }

        const manager = global.subbots
        const action = (m.args[0] || '').toLowerCase()
        const userNumber = m.sender.number || m.sender.id.split('@')[0]

        if (['off', 'disable', 'desactivar'].includes(action)) {
            if (!m.chat.isGroup) return m.reply('[!] Este ajuste solo se puede aplicar en grupos.')
            if (!m.sender.isAdmin && !m.sender.role('root', 'owner')) return m.sms('admin')

            const chatDB = await m.chat.db()
            chatDB.subbotDisabled = true
            return m.reply('✦ Sub-bots desactivados en este grupo. Nadie podra usarlos aqui.')
        }

        if (['on', 'enable', 'activar'].includes(action)) {
            if (!m.chat.isGroup) return m.reply('[!] Este ajuste solo se puede aplicar en grupos.')
            if (!m.sender.isAdmin && !m.sender.role('root', 'owner')) return m.sms('admin')

            const chatDB = await m.chat.db()
            chatDB.subbotDisabled = false
            return m.reply('✦ Sub-bots reactivados con exito en este grupo.')
        }

        if (action === 'list') {
            await m.react('wait')
            const activeIds = manager.InstancesActive()
            const totalStored = manager.StoreIPCs.list()

            if (!activeIds.length) {
                await m.react('done')
                return m.reply('[!] No hay Sub-Bots conectados actualmente.')
            }

            const rows = activeIds.map((id, idx) => {
                const inst = manager.getInstance(id)
                const uptime = formatUptime(inst?.worker?.uptime)
                return `╵ ${idx + 1}. +${id} / Activo: ${uptime}`
            })

            const text = [
                `╭○ *Sub-Bots Activos*`,
                `╵ Conectados: ${activeIds.length}`,
                `╵ Guardados en BD: ${totalStored.length}`,
                '╰╶╴──────╶╴─╶╴◯',
                '',
                rows.join('\n'),
                '',
                '╰╶╴──────╶╴─╶╴◯'
            ].join('\n')

            await m.reply(text)
            return await m.react('done')
        }

        if (['stop', 'del', 'delete'].includes(action)) {
            await m.react('wait')
            const isSuper = m.sender.role('owner', 'root')
            const targetId = isSuper && m.args[1] ? m.args[1].replace(/\D/g, '') : userNumber

            if (!manager.hasStoredInstance(targetId) && !manager.hasInstance(targetId)) {
                await m.react('error')
                return m.reply(`[!] No existe ninguna sesion de Sub-Bot para +${targetId}.`)
            }

            await manager.destroyInstance(targetId)
            await m.react('done')
            return m.reply(`✦ Sesion del Sub-Bot (+${targetId}) eliminada correctamente.`)
        }

        await m.react('wait')

        let targetNumber = m.args[0] && /^\d+$/.test(m.args[0].replace(/\D/g, ''))
            ? m.args[0].replace(/\D/g, '')
            : userNumber

        if (!targetNumber || targetNumber.length < 8 || m.sender.id.includes('@lid')) {
            await m.react('error')
            return m.reply('[!] No se pudo extraer tu numero automaticamente (estas usando un @lid o no es valido).\n\nEspecifica tu numero con codigo de pais.\n\n*Uso:*\n.subbot ‹numero›')
        }

        if (manager.hasInstance(targetNumber)) {
            await m.react('error')
            return m.reply('[!] Ya tienes una sesion activa en ejecucion.\nUsa *.subbot stop* para cerrarla.')
        }

        try {
            await m.reply('[!] Generando codigo de vinculacion... Espera unos segundos.')

            const instance = await manager.spawnSubbot(targetNumber, {
                connectType: 'pin-code',
                phoneNumber: targetNumber
            })

            let codeSent = false

            instance.on('connection.update', async (update) => {
                if (update.type === 'connection_pairing' && update.data?.pairingCode && !codeSent) {
                    codeSent = true
                    
                    const rawCode = String(update.data.pairingCode).replace(/[^a-zA-Z0-9]/g, '')
                    const formattedCode = rawCode.match(/.{1,4}/g)?.join('-') || rawCode

                    const promptText = [
                        `╭○ *Codigo de Vinculacion*`,
                        `╵ Numero: +${targetNumber}`,
                        `╵ Codigo: *${formattedCode}*`,
                        '╰╶╴──────╶╴─╶╴◯',
                        '',
                        '1. Abre WhatsApp en tu telefono.',
                        '2. Ve a Dispositivos vinculados.',
                        '3. Toca en "Vincular con numero de telefono".',
                        '4. Toca el boton inferior para copiar el codigo e ingresalo.',
                        '',
                        '[!] Expira en 60 segundos.'
                    ].join('\n')

                    const buttons = [
                        {
                            type: 'copy',
                            text: 'Copiar Codigo',
                            payload: rawCode
                        }
                    ]

                    try {
                        await sock.sendMessage(m.chat.id, {
                            mediaMenu: {
                                image: BANNER_URL,
                                title: 'Aethero Sub-Bot',
                                subtitle: `+${targetNumber}`,
                                body: promptText,
                                footer: 'Aethero Engine / Baileys-IPC',
                                buttons
                            }
                        }, { quoted: m.raw })
                    } catch (err) {
                        await m.reply(`✦ *Codigo de Vinculacion*\n\nNumero: +${targetNumber}\nCodigo: *${formattedCode}*`)
                    }
                }

                if (update.type === 'connection_open') {
                    await m.reply(`✦ *Sub-Bot conectado con exito* (+${targetNumber}). Tu cuenta ya puede responder comandos.`)
                }
            })

            await m.react('done')

        } catch (err) {
            console.error('[SubBot Spawn Error]:', err)
            await m.react('error')
            await m.reply(`[!] Error al iniciar el Sub-Bot: ${err.message}`)
        }
    }
}