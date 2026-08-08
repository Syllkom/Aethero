// ./plugins/owner/dump.plugin.js
import { proto } from '@whiskeysockets/baileys'

function detectAdditionalNodes(rawJson) {
    const has = (s) => rawJson.includes(s)

    if (has('"botAIMessage"') || has('"aiChatMessage"') || has('"forwardedAiBotMessageInfo"')) {
        return JSON.stringify({
            additionalNodes: [
                { attrs: { biz_bot: "1" }, tag: "bot" },
                { attrs: {}, tag: "biz" }
            ]
        }, null, 2)
    }

    if (has('"interactiveMessage"') || has('"buttonsMessage"') || has('"nativeFlowMessage"')) {
        if (has('"catalog_message"')) {
            return JSON.stringify({ additionalNodes: [{ tag: "biz", attrs: { native_flow_name: "catalog_message" } }] }, null, 2)
        }
        if (has('"order_details"')) {
            return JSON.stringify({ additionalNodes: [{ tag: "biz", attrs: { native_flow_name: "order_details" } }] }, null, 2)
        }
        if (has('"payment_key_info"')) {
            return JSON.stringify({ additionalNodes: [{ tag: "biz", attrs: {}, content: [{ tag: "interactive", attrs: { type: "native_flow", v: "1" }, content: [{ tag: "native_flow", attrs: { name: "payment_key_info" } }] }] }] }, null, 2)
        }
        return JSON.stringify({
            additionalNodes: [
                {
                    tag: "biz",
                    attrs: {},
                    content: [
                        {
                            tag: "interactive",
                            attrs: { type: "native_flow", v: "1" },
                            content: [
                                { tag: "native_flow", attrs: { v: "9", name: "mixed" } }
                            ]
                        }
                    ]
                }
            ]
        }, null, 2)
    }

    if (has('"pollCreationMessage"') || has('"pollCreationMessageV3"')) {
        return JSON.stringify({ additionalNodes: [{ tag: "meta", attrs: { polltype: "creation" } }] }, null, 2)
    }

    return "{}"
}

export default {
    command: true, usePrefix: true,
    case: ['dump', 'json', 'crm'],
    description: 'Destripa mensajes citados extrayendo su Protobuf limpio y genera código de retransmisión.',
    category: 'owner',
    usage: 'dump',
    script: async (m, { sock }) => {
        if (!m.sender.role('root', 'owner')) return m.sms('owner')
        if (!m.quoted) return m.reply('ⓘ Cita el mensaje que quieres destripar.')

        await m.react('wait')

        try {
            const getPayload = (obj) => {
                if (!obj) return null
                if (obj.message?.message) return obj.message.message
                if (obj.message && !obj.key) return obj.message
                if (obj.buttonsMessage || obj.interactiveMessage || obj.imageMessage || obj.conversation) return obj
                return obj.message || obj
            }

            const loadedMsg = await sock.loadMessage(m.chat.id, m.quoted.id)
            const targetContent = getPayload(loadedMsg) || getPayload(m.quoted)

            if (!targetContent || Object.keys(targetContent).length === 0) {
                await m.react('error')
                return m.reply('ⓘ No se pudo extraer el cuerpo binario del mensaje citado.')
            }

            const toPOJO = (obj) => {
                if (obj === null || obj === undefined) return obj
                if (Buffer.isBuffer(obj) || obj instanceof Uint8Array) return Buffer.from(obj).toString('base64')
                if (obj.type === 'Buffer' && Array.isArray(obj.data)) return Buffer.from(obj.data).toString('base64')
                if (Array.isArray(obj)) return obj.map(toPOJO)
                if (typeof obj === 'object') {
                    if (typeof obj.toNumber === 'function' || (obj.low !== undefined && obj.high !== undefined)) return obj.toString()
                    const res = {}
                    for (const key of Object.keys(obj)) {
                        if (typeof obj[key] === 'function' || key === 'toJSON' || key === 'constructor') continue
                        res[key] = toPOJO(obj[key])
                    }
                    return res
                }
                return obj
            }

            const safeContent = toPOJO(targetContent)
            let cleanObj = safeContent

            try {
                const protoMsg = proto.Message.fromObject(targetContent)
                const decoded = proto.Message.toObject(protoMsg, {
                    enums: Number,
                    longs: String,
                    bytes: String,
                    defaults: false
                })

                const deepMerge = (target, source) => {
                    for (const key in source) {
                        if (source[key] === null || source[key] === undefined) continue
                        if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
                            target[key] = target[key] || {}
                            deepMerge(target[key], source[key])
                        } else if (target[key] === undefined) {
                            target[key] = source[key]
                        }
                    }
                    return target
                }

                cleanObj = deepMerge(decoded, safeContent)
            } catch (e) {
                console.log('[Dump] Protobuf fallback:', e.message)
            }

            const rawJson = JSON.stringify(cleanObj, null, 2)
            const cleanJson = rawJson.replace(/\\n/g, '\\n')

            const ignoreKeys = ['messageContextInfo', 'senderKeyDistributionMessage', 'inviteLinkGroupTypeV2']
            const realTypeKey = Object.keys(cleanObj).find(k => !ignoreKeys.includes(k))

            const typeName = realTypeKey || m.quoted.type || "unknown"
            const senderName = m.quoted.sender?.name || m.quoted.sender?.number || "Desconocido"
            const ts = new Date().toLocaleString("es-ES", { timeZone: "America/Lima" })

            const relayOptsStr = detectAdditionalNodes(rawJson)
            const jsContent = `await sock.relayMessage(\n  m.chat.id,\n  ${cleanJson},\n  ${relayOptsStr}\n)`

            const headerInfo = [
                "// Información del Paquete",
                `// Tipo       : ${typeName}`,
                `// Emisor     : ${senderName}`,
                `// ID         : ${m.quoted.id}`,
                `// Timestamp  : ${ts}`
            ].join("\n")

            await sock.sendMessage(m.chat.id, {
                richResponse: {
                    styleClassic: true,
                    normalText: headerInfo,
                    code: {
                        language: "javascript",
                        code: jsContent
                    },
                    footer: "Aethero Advanced Engine | Destripador de Protocolos"
                }
            }, { quoted: m.raw })

            await m.react('done')

        } catch (e) {
            console.error('Dump Error:', e)
            await m.react('error')
            await m.reply(`ⓘ Error al extraer paquete: ${e.message}`)
        }
    }
}