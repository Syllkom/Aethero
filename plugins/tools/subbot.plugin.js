import fs from 'fs'
import path from 'path'
import { MakeClient } from '../../core/library/waClient.js'
import socketExtensions from '../../library/socket.extensions.js'
import { resolveMessage } from '../../core/library/message.js'

global.subBots = global.subBots || new Map()

function getSubBotNumber(sessionId) {
    try {
        const sessionFile = path.resolve(`./storage/subs/${sessionId}/creds/session.json`)
        if (fs.existsSync(sessionFile)) {
            const data = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'))
            const jid = data?.creds?.me?.id
            if (jid) return jid.split('@')[0].split(':')[0]
        }
    } catch {}
    return null
}

async function startSubBot(numero, sid, isReconnect = false, initiatorChatId = null, modules, mainSock) {
    const sessionPath = path.resolve(`./storage/subs/${sid}`)
    const credsPath = path.resolve(sessionPath, 'creds')

    if (!isReconnect && fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true })
    }
    fs.mkdirSync(credsPath, { recursive: true })

    const subClient = new MakeClient()

    subClient.events.on('connection', async (update) => {
        if (update.type === 'pairing' && update.event === 'pin-code' && initiatorChatId) {
            const rawCode = update.data?.pairingCode || ''
            const formattedCode = update.data?.formattedCode || rawCode
            const rawPayload = rawCode.replace(/\D/g, '')

            await mainSock.sendMessage(initiatorChatId, {
                interactiveMenu: {
                    body: `Codigo de Vinculacion Sub-Bot\n\nTu codigo es: *${formattedCode}*\n\nVe a Dispositivos vinculados > Vincular con numero de telefono en tu WhatsApp.`,
                    footer: 'Aethero Engine - SubBot System',
                    buttons: [
                        { type: 'copy', text: 'Copiar Codigo', payload: rawPayload }
                    ]
                }
            })
        }

        if (update.type === 'open') {
            if (initiatorChatId) {
                await mainSock.sendMessage(initiatorChatId, {
                    text: `Sub-bot de @${sid} vinculado y acoplado al Engine exitosamente.`,
                    contextInfo: { mentionedJid: [`${sid}@lid`, `${sid}@s.whatsapp.net`] }
                })
            }
        }

        if (update.type === 'restart' || (update.type === 'error' && update.reasonCode === 428)) {
            const existing = global.subBots.get(sid)
            if (existing?.sock?.isPurging) return
            return await subClient.restart({
                sessionName: sid,
                folderPath: credsPath
            })
        }

        if (update.type === 'closed') {
            global.subBots.delete(sid)
            if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true })
            if (initiatorChatId) {
                await mainSock.sendMessage(initiatorChatId, {
                    text: `La sesion del sub-bot @${sid} fue cerrada permanentemente.`,
                    contextInfo: { mentionedJid: [`${sid}@lid`] }
                })
            }
        }
    })

    const subSock = await subClient.start({
        connectType: isReconnect ? 'qr-code' : 'pin-code',
        phoneNumber: numero,
        sessionName: sid,
        folderPath: credsPath
    })

    if (!subSock) return

    subSock.plugins = modules.getFolder('plugins')
    subSock.modules = modules
    subSock.isSubBot = true
    subSock.sessionId = sid

    await socketExtensions(subSock)
    global.subBots.set(sid, { client: subClient, sock: subSock, startTime: Date.now() })

    const mainLogic = modules.getFolder('handlers')

    subSock.ev.on('messages.upsert', async (rawMessages) => {
        const list = rawMessages?.messages
        if (!list || !Array.isArray(list)) return

        for (let rawMessage of list) {
            if (!rawMessage) continue
            const message = resolveMessage(rawMessage.message)

            const m = {
                key: rawMessage.key,
                message: rawMessage.message,
                get raw() { return rawMessage },
                id: rawMessage.key.id,
                category: message.category,
                type: message.type,
                get messageData() { return message.messageData },
                contextInfo: message.messageData?.contextInfo,
                messageTimestamp: rawMessage.messageTimestamp,
                broadcast: rawMessage.broadcast,
                pushName: rawMessage.pushName
            }

            if (m.contextInfo?.quotedMessage) {
                const botId = subSock.user?.id?.split(':')[0]
                const quotedId = m.contextInfo.stanzaId
                const remoteJid = m.contextInfo.remoteJid || m.raw.key.remoteJid
                const participant = m.contextInfo.participant || remoteJid
                const fromMe = participant.split(':')[0] === botId || participant === subSock.user?.lid

                let fullRaw = null
                if (global.db && global.config?.saveHistory) {
                    try {
                        const chatIndex = await global.db.open('@history/' + remoteJid)
                        const sender = chatIndex[quotedId] || participant
                        const userHist = await global.db.open('@history/' + remoteJid + '/' + sender)
                        if (Array.isArray(userHist.data)) {
                            fullRaw = userHist.data.find(msg => msg.key?.id === quotedId) || null
                        }
                    } catch {}
                }

                const quotedKey = {
                    remoteJid: remoteJid,
                    fromMe: fromMe,
                    id: quotedId,
                    participant: participant
                }

                const realMessagePayload = fullRaw?.message || m.contextInfo.quotedMessage
                const quoted = resolveMessage(realMessagePayload)

                m.quoted = {
                    key: quotedKey,
                    id: quotedId,
                    type: quoted.type,
                    category: quoted.category,
                    get messageData() { return quoted.messageData },
                    contextInfo: quoted.messageData?.contextInfo || m.contextInfo,
                    quotedType: m.contextInfo?.quotedType,
                    message: realMessagePayload,
                    quotedMessage: m.contextInfo.quotedMessage,
                    rawMessage: fullRaw?.message || m.contextInfo.quotedMessage,
                    raw: fullRaw || { key: quotedKey, message: m.contextInfo.quotedMessage },
                    fullRaw: fullRaw,
                    fakeObj: {
                        key: quotedKey,
                        message: realMessagePayload
                    }
                }
            }

            try {
                let control = { end: false }
                const files = mainLogic.query({ enabled: true })
                const sort = files.sort((a, b) => (a.priority ?? Infinity) - (b.priority ?? Infinity))

                for (let handler of sort) {
                    if (control.end) break
                    await handler.script.call(m, {
                        sock: subSock,
                        control,
                        modules
                    })
                }
            } catch (e) {
                console.error('[SubBot Handler Error]:', e)
            }
        }
    })
}

export default {
    before: true,
    index: 1,
    command: true,
    usePrefix: true,
    case: ['bot', 'subbot'],
    description: 'Gestion de instancias secundarias (sub-bots).',
    category: 'bots',
    usage: ['.bot create <numero>', '.bot stop', '.bot list'],
    script: async (m, { sock, modules }) => {
        if (!global.subBotsBooted) {
            global.subBotsBooted = true
            const subsDir = path.resolve('./storage/subs')
            if (fs.existsSync(subsDir)) {
                const folders = fs.readdirSync(subsDir)
                for (const folder of folders) {
                    if (!global.subBots.has(folder)) {
                        const phoneNum = getSubBotNumber(folder)
                        if (phoneNum) {
                            startSubBot(phoneNum, folder, true, null, modules, sock)
                        }
                    }
                }
            }
        }

        if (!m.isCmd || !['bot', 'subbot'].includes(m.command)) return

        const sub = m.args[0]?.toLowerCase()
        const sessionId = m.sender.number

        if (sub === 'create' || sub === 'vincular') {
            let numero = m.args[1]
            if (!numero && m.quoted) numero = m.quoted.sender.number

            if (!numero || isNaN(numero.replace(/\D/g, ''))) {
                return m.reply('Uso correcto: .bot create <numero>')
            }

            numero = numero.replace(/\D/g, '')

            if (global.subBots.has(sessionId)) {
                return m.reply('Ya tienes una sesion activa. Usa .bot stop antes de crear otra.')
            }

            if (global.subBots.size >= 5) {
                return m.reply('El limite maximo de sub-bots en este Engine ha sido alcanzado.')
            }

            global.subBots.set(sessionId, 'pending')
            await m.reply('Sistema Sub-Bot\nSolicitando codigo de vinculacion a Meta...\nEspera unos segundos.')

            await startSubBot(numero, sessionId, false, m.chat.id, modules, sock)
            return
        }

        if (sub === 'stop' || sub === 'detener') {
            if (!global.subBots.has(sessionId)) {
                return m.reply('No tienes ningun sub-bot activo.')
            }

            const item = global.subBots.get(sessionId)
            if (item && item.sock && typeof item.sock.end === 'function') {
                item.sock.isPurging = true
                item.sock.end(new Error('Cerrado por el usuario'))
            }
            global.subBots.delete(sessionId)

            const sessionPath = path.resolve(`./storage/subs/${sessionId}`)
            if (fs.existsSync(sessionPath)) {
                fs.rmSync(sessionPath, { recursive: true, force: true })
            }
            return m.reply('Sesion de sub-bot detenida y credenciales eliminadas.')
        }

        if (sub === 'list' || sub === 'lista') {
            if (!m.sender.role('admin', 'owner', 'root')) return m.reply('Solo los administradores pueden ver esta lista.')

            const list = []
            const mentions = []

            for (const [sid, item] of global.subBots.entries()) {
                if (item && item !== 'pending') {
                    list.push(`- @${sid} (Online)`)
                    mentions.push(`${sid}@lid`, `${sid}@s.whatsapp.net`)
                } else if (item === 'pending') {
                    list.push(`- @${sid} (Pendiente)`)
                    mentions.push(`${sid}@lid`, `${sid}@s.whatsapp.net`)
                }
            }

            if (list.length === 0) {
                return m.reply('No hay sub-bots activos en este Engine.')
            }

            let text = 'Sub-Bots Activos en Memoria\n\n'
            text += `Total en ejecucion: ${list.length}/5\n\n`
            text += list.join('\n')

            return m.reply({ text: text, contextInfo: { mentionedJid: mentions } })
        }

        return m.reply(
            'Panel de Gestion de Sub-Bots\n\n' +
            '- .bot create <numero> - Solicita un codigo de vinculacion para crear tu sub-bot\n' +
            '- .bot stop - Apaga tu sub-bot y borra su sesion\n' +
            '- .bot list - Lista de sub-bots activos en el servidor'
        )
    }
}