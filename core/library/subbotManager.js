// ./core/library/subbotManager.js
import path from 'path'
import { BaileysIPC } from 'baileys-ipc'
import { resolveMessage } from './message.js'
import { dbStorage, createDbInstance } from './hyperDBAdapter.js'
import socketExtensions from '../../library/socket.extensions.js'

let subbotManagerInstance = null
const subDbInstances = new Map()

export async function initSubbotManager({ modules, mainLogic }) {
    if (subbotManagerInstance) return subbotManagerInstance

    const storagePath = path.resolve('./storage/subs')
    const manager = new BaileysIPC(storagePath)

    const getSubDb = async (instanceId) => {
        if (subDbInstances.has(instanceId)) return subDbInstances.get(instanceId)
        
        const subFolder = path.resolve(`./storage/subs/${instanceId}/store`)
        const subDb = createDbInstance(subFolder)
        await subDb.start()
        
        subDbInstances.set(instanceId, subDb)
        return subDb
    }

    const patchWorkerSafety = (instance) => {
        if (!instance.worker) return
        const rawWorker = instance.worker
        rawWorker.send = function (data, transferList) {
            if (!this.worker) return null
            try {
                if (Array.isArray(transferList) && transferList.length > 0) {
                    return this.worker.postMessage(data, transferList)
                }
                return this.worker.postMessage(data)
            } catch (e) {
                return console.error(e)
            }
        }
    }

    const setupSubbotUser = (instance) => {
        const creds = manager.StoreIPCs.getCreds(instance.instanceId)
        const rawId = (creds?.me?.id || instance.instanceId).split('@')[0].split(':')[0]
        const rawLid = creds?.me?.lid ? creds.me.lid.split('@')[0].split(':')[0] : null

        const userData = {
            id: `${rawId}@s.whatsapp.net`,
            lid: rawLid ? `${rawLid}@lid` : null,
            name: creds?.me?.name || 'Sub-Bot'
        }

        instance.sock.user = userData
        instance.sock.conn = instance.sock
        if (instance.Intercept) instance.Intercept.user = userData
    }

    const bindSubbotSocket = async (instance) => {
        if (!instance.sock) return
        patchWorkerSafety(instance)
        setupSubbotUser(instance)

        if (global.sock?.waUploadToServer) {
            instance.sock.waUploadToServer = global.sock.waUploadToServer
        }
        
        // Asignamos la DB al socket por si algún plugin quiere usarla directo
        instance.sock.db = await getSubDb(instance.instanceId)

        instance.sock.isSubbot = true
        instance.sock.plugins = modules.getFolder('plugins')
        instance.sock.modules = modules
        await socketExtensions(instance.sock)

        instance.sock.profilePictureUrl = async (jid, type = 'image') => {
            try {
                if (typeof global.sock?.profilePictureUrl === 'function') {
                    return await global.sock.profilePictureUrl(jid, type)
                }
            } catch {}
            return 'https://files.catbox.moe/obz4b4.jpg'
        }

        instance.sock._extensionsBound = true
    }

    const attachPipeline = (instance) => {
        instance.on('messages.upsert', async (rawMessages) => {
            const messages = rawMessages?.messages
            if (!Array.isArray(messages) || !instance.sock) return

            if (!instance.sock._extensionsBound) {
                await bindSubbotSocket(instance)
            }

            // Obtenemos la DB de este subbot
            const subDb = await getSubDb(instance.instanceId)

            for (const rawMessage of messages) {
                if (!rawMessage || !rawMessage.message) continue

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
                    const botId = instance.sock.user?.id?.split(':')[0]
                    const quotedId = m.contextInfo.stanzaId
                    const remoteJid = m.contextInfo.remoteJid || m.raw.key.remoteJid
                    const participant = m.contextInfo.participant || remoteJid
                    const fromMe = participant.split(':')[0] === botId || participant === instance.sock.user?.lid

                    const quotedKey = {
                        remoteJid,
                        fromMe,
                        id: quotedId,
                        participant
                    }

                    const realMessagePayload = m.contextInfo.quotedMessage
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
                        rawMessage: m.contextInfo.quotedMessage,
                        raw: { key: quotedKey, message: m.contextInfo.quotedMessage },
                        fakeObj: { key: quotedKey, message: realMessagePayload }
                    }
                }

                m.sock = instance.sock

                try {
                    const control = { end: false }
                    const files = mainLogic.query({ enabled: true })
                    const sorted = files.sort((a, b) => (a.priority ?? Infinity) - (b.priority ?? Infinity))

                    // ENVOLVEMOS EL PIPELINE EN EL CONTEXTO DE LA DB DEL SUBBOT
                    await dbStorage.run(subDb, async () => {
                        for (const handler of sorted) {
                            if (control.end || !instance.sock) break
                            await handler.script.call(m, {
                                sock: instance.sock,
                                conn: instance.sock,
                                control,
                                modules
                            })
                        }
                    })
                    
                } catch (err) {
                    console.error(`[SubBot:${instance.instanceId}] Error en pipeline:`, err.stack || err)
                }
            }
        })

        instance.on('connection.update', async (update) => {
            if (update.type === 'connection_open') {
                console.log(`[SubBot:${instance.instanceId}] Sesion conectada con exito`)
                setupSubbotUser(instance)
                await bindSubbotSocket(instance)
            }
        })
    }

    const saved = manager.StoreIPCs.list()
    for (const id of saved) {
        try {
            console.log(`[SubBot Manager] Restaurando sesion de SQLite: ${id}`)
            const instance = manager.createInstance(id, { connectType: 'qr-code' })
            await bindSubbotSocket(instance)
            attachPipeline(instance)
            await instance.start()
        } catch (e) {
            console.error(`[SubBot Manager] Error restaurando ${id}:`, e.message)
        }
    }

    manager.spawnSubbot = async (instanceId, options) => {
        const instance = manager.createInstance(instanceId, options)
        await bindSubbotSocket(instance)
        attachPipeline(instance)
        await instance.start()
        return instance
    }

    subbotManagerInstance = manager
    return manager
}