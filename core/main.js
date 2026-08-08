// ./core/main.js
import path from 'path'
import { pathToFileURL } from 'url'
import chalk from 'chalk'
import fs from 'fs'

chalk.level = 2

const env = {}
for (const key of Object.keys(process.env)) {
    try { env[key] = JSON.parse(process.env[key]) }
    catch { env[key] = process.env[key] }
}

if (!env.STORAGE) throw new Error('STORAGE missing')

fs.mkdirSync(env.STORAGE, { recursive: true })
for (const _folder of ['creds', 'store', 'temp']) {
    fs.mkdirSync(path.join(env.STORAGE, _folder), { recursive: true })
}

if (env.CONFIG) await import(pathToFileURL(env.CONFIG))

if (!env.MODULEREGISTRY) throw new Error('MODULEREGISTRY missing')
if (!Array.isArray(env.MODULEREGISTRY)) throw new Error('MODULEREGISTRY must be an array')

for (const module of env.MODULEREGISTRY) {
    if (!fs.existsSync(module.folder)) throw new Error(`Folder not found: ${module.folder}`)
}

const mainModule = env.MODULEREGISTRY.find(o => o.mainLogic)
if (!mainModule) throw new Error('Main execution module missing')

// Librerías del sistema
import db from './library/hyperDBAdapter.js'
import '../library/garbageCollector.js'
import { MakeClient } from './library/waClient.js'
import { ModuleRegistry } from './library/modules.js'
import { resolveMessage } from './library/message.js'
import socketExtensions from '../library/socketExtensions.js'


// Inicializar DB y Scrapers
await db.start()



const modules = await (new ModuleRegistry(env.MODULEREGISTRY)).start()
const mainFolderName = path.basename(mainModule.folder)
const mainLogic = modules.getFolder(mainFolderName)

async function StartBot() {
    const mainBot = new MakeClient()

    mainBot.events.on('connection', async (update) => {
        process.send(update)

        if (update.type === 'open' && global.config?.startupNotification && mainBot.sock) {
            try {
                const rootNumber = Object.keys(global.config.userRoles || {})[0] || '5216678432366'
                const rootJid = rootNumber.includes('@') ? rootNumber : rootNumber + '@s.whatsapp.net'
                const dateStr = new Date().toLocaleString('es-ES', { timeZone: 'America/Lima' })

                const fakeQ = await mainBot.sock.fakeOrder(rootJid, {
                    orderId: "AETHERO_V3",
                    itemCount: 374,
                    message: "Powered by Syllkom",
                    orderTitle: "Aethero Store",
                    price: 374,
                    currency: "USD"
                })

                await mainBot.sock.sendMessage(rootJid, {
                    adMenu: {
                        title: "Anuncio de Aethero",
                        body: `▢ Aethero Conectado\n● Sistema en línea con éxito.\n- Fecha: ${dateStr}\n- PID: ${process.pid}`
                    }
                }, { quoted: fakeQ })
            } catch (err) {
                console.error('Error al enviar la notificación de inicio:', err.message)
            }
        }
    })

    const sock = await mainBot.start({
        folderPath: path.join(env.STORAGE, 'creds'),
        ...env.connOptions
    })

    sock.plugins = modules.getFolder('plugins')
    sock.modules = modules

    await socketExtensions(sock)

    mainBot.events.on('messages', async (rawMessages) => {
        rawMessages = rawMessages?.messages
        if (!rawMessages) return

        for (let rawMessage of rawMessages) {
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
                pushName: rawMessage.pushName,
            }

            if (m.contextInfo?.quotedMessage) {
                const bot = sock.user.id.split(":")[0]
                const key = { id: m.contextInfo?.stanzaId }
                key.remoteJid = m.contextInfo?.remoteJid || m.raw.key.remoteJid
                key.fromMe = m.contextInfo?.participant === bot + "@s.whatsapp.net"
                key.participant = m.contextInfo?.participant

                const quotedMessage = m.contextInfo?.quotedMessage
                const quoted = resolveMessage(quotedMessage)

                m.quoted = {
                    key: key,
                    message: quotedMessage,
                    id: m.contextInfo?.stanzaId,
                    type: quoted.type,
                    get raw() { return { key, message: quotedMessage } },
                    get messageData() { return quoted.messageData },
                    contextInfo: quoted.messageData.contextInfo,
                    quotedType: m.contextInfo?.quotedType,
                    category: quoted.category,
                }
            }

            try {
                let control = { end: false }
                const files = mainLogic.query({ enabled: true })
                const sort = files.sort((a, b) => {
                    const priorityA = a.priority ?? Infinity
                    const priorityB = b.priority ?? Infinity
                    return priorityA - priorityB
                })

                for (let handler of sort) {
                    if (control.end) break
                    await handler.script.call(m, {
                        sock, control, modules
                    })
                }
            } catch (e) {
                if (e.statusCode === 774)
                    throw new Error('Tumba la casa mami')
                if (e.output?.statusCode === 428)
                    throw new Error('Tumba la casa mami')
                else console.error('main.js', e)
            }
        }
    })

    sock.ev.on('call', async (call) => {
        const callInfo = call[0]
        if (callInfo.status === 'offer') {
            await sock.rejectCall(callInfo.id, callInfo.from)
        }
    })
}

await StartBot()