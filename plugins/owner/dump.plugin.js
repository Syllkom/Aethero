// ./plugins/owner/dump.plugin.js
function unwrapMessage(msg) {
    let current = msg || {}
    while (
        current.ephemeralMessage ||
        current.viewOnceMessage ||
        current.viewOnceMessageV2 ||
        current.viewOnceMessageV2Extension ||
        current.documentWithCaptionMessage ||
        current.editedMessage ||
        (current.pollCreationMessageV4 && current.pollCreationMessageV4.message) ||
        (current.pollCreationMessageV5 && current.pollCreationMessageV5.message)
    ) {
        if (current.ephemeralMessage) current = current.ephemeralMessage.message || {}
        else if (current.viewOnceMessage) current = current.viewOnceMessage.message || {}
        else if (current.viewOnceMessageV2) current = current.viewOnceMessageV2.message || {}
        else if (current.viewOnceMessageV2Extension) current = current.viewOnceMessageV2Extension.message || {}
        else if (current.documentWithCaptionMessage) current = current.documentWithCaptionMessage.message || {}
        else if (current.editedMessage) current = current.editedMessage.message?.protocolMessage?.editedMessage || {}
        else if (current.pollCreationMessageV4?.message) current = current.pollCreationMessageV4.message
        else if (current.pollCreationMessageV5?.message) current = current.pollCreationMessageV5.message
    }
    return current
}

function getMessageAssociation(rawMsg) {
    const m = rawMsg?.message || rawMsg || {}
    const unwrapped = unwrapMessage(m)
    
    return m.messageContextInfo?.messageAssociation
        || m.ephemeralMessage?.message?.messageContextInfo?.messageAssociation
        || unwrapped.messageContextInfo?.messageAssociation
        || unwrapped.imageMessage?.contextInfo?.messageAssociation
        || unwrapped.videoMessage?.contextInfo?.messageAssociation
        || unwrapped.pollCreationOptionImageMessage?.messageContextInfo?.messageAssociation
        || null
}

function detectAdditionalNodes(obj) {
    const rawJson = typeof obj === 'string' ? obj : JSON.stringify(obj)
    const has = (s) => rawJson.includes(s)

    if (has('"pollCreationOptionImageMessage"') || has('"media_poll"')) {
        return {
            additionalNodes: [
                {
                    tag: "meta",
                    attrs: {
                        message_association_type: "media_poll"
                    }
                }
            ]
        }
    }

    if (has('"pollCreationMessage"') || has('"pollCreationMessageV3"') || has('"pollCreationMessageV4"') || has('"pollCreationMessageV5"')) {
        const isImagePoll = has('"pollContentType": 2') || has('"pollContentType":2')
        return {
            additionalNodes: [
                {
                    tag: "meta",
                    attrs: {
                        polltype: "creation",
                        ...(isImagePoll ? { contenttype: "image" } : {})
                    }
                }
            ]
        }
    }

    if (has('"botAIMessage"') || has('"aiChatMessage"') || has('"forwardedAiBotMessageInfo"')) {
        return {
            additionalNodes: [
                { attrs: { biz_bot: "1" }, tag: "bot" },
                { attrs: {}, tag: "biz" }
            ]
        }
    }

    if (has('"interactiveMessage"') || has('"buttonsMessage"') || has('"nativeFlowMessage"')) {
        if (has('"catalog_message"')) {
            return { additionalNodes: [{ tag: "biz", attrs: { native_flow_name: "catalog_message" } }] }
        }
        if (has('"order_details"')) {
            return { additionalNodes: [{ tag: "biz", attrs: { native_flow_name: "order_details" } }] }
        }
        if (has('"payment_key_info"')) {
            return { additionalNodes: [{ tag: "biz", attrs: {}, content: [{ tag: "interactive", attrs: { type: "native_flow", v: "1" }, content: [{ tag: "native_flow", attrs: { name: "payment_key_info" } }] }] }] }
        }
        return {
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
        }
    }

    return {}
}

function cleanPOJO(obj) {
    if (obj === null || obj === undefined) return obj
    if (Buffer.isBuffer(obj) || obj instanceof Uint8Array) {
        return `__BUFFER_START__${Buffer.from(obj).toString('base64')}__BUFFER_END__`
    }
    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
        return `__BUFFER_START__${Buffer.from(obj.data).toString('base64')}__BUFFER_END__`
    }
    if (Array.isArray(obj)) return obj.map(cleanPOJO)
    if (typeof obj === 'object') {
        if (typeof obj.toNumber === 'function' || (obj.low !== undefined && obj.high !== undefined)) return obj.toString()
        const res = {}
        for (const key of Object.keys(obj)) {
            if (typeof obj[key] === 'function' || key === 'toJSON' || key === 'constructor') continue
            res[key] = cleanPOJO(obj[key])
        }
        return res
    }
    return obj
}

function formatJsonCode(obj) {
    let str = JSON.stringify(cleanPOJO(obj), null, 2)
    str = str.replace(/"__BUFFER_START__(.*?)__BUFFER_END__"/g, 'Buffer.from("$1", "base64")')
    return str
}

export default {
    command: true, usePrefix: true,
    case: ['dump', 'json', 'crm'],
    description: 'Destripa paquetes simples o compuestos (Álbumes, Encuestas con imagen, Botones).',
    category: 'owner',
    usage: ['dump'],
    script: async (m, { sock }) => {
        if (!m.sender.role('root', 'owner')) return m.sms('owner')
        if (!m.quoted) return m.reply('ⓘ Cita el mensaje que deseas destripar.')

        await m.react('wait')

        try {
            const quotedId = m.quoted.id
            const chatJid = m.chat.id

            const chatIndex = await global.db.open('@history/' + chatJid)
            const senders = [...new Set(Object.values(chatIndex || {}))]

            let allChatMessages = []
            for (const s of senders) {
                const hist = await global.db.open('@history/' + chatJid + '/' + s)
                if (Array.isArray(hist.data)) allChatMessages.push(...hist.data)
            }

            const directAssoc = getMessageAssociation(m.quoted.raw || m.quoted)
            let rootParentId = directAssoc?.parentMessageKey?.id || quotedId

            let parentMsgRaw = allChatMessages.find(msg => msg.key?.id === rootParentId) || (rootParentId === quotedId ? m.quoted.raw : null)
            
            let childMsgs = allChatMessages.filter(msg => {
                const assoc = getMessageAssociation(msg)
                return assoc?.parentMessageKey?.id === rootParentId
            })

            let rawParentContent = parentMsgRaw?.message || m.quoted.raw?.message || m.quoted.message || {}
            let parentPayload = unwrapMessage(rawParentContent)

            if (parentPayload.pollCreationMessageV3) {
                parentPayload = {
                    ...(rawParentContent.messageContextInfo ? { messageContextInfo: rawParentContent.messageContextInfo } : {}),
                    pollCreationMessageV3: parentPayload.pollCreationMessageV3
                }
            }

            if (childMsgs.length > 0) {
                const parentType = Object.keys(parentPayload || {})[0] || 'pollCreationMessageV3'
                const parentNodes = detectAdditionalNodes(parentPayload)
                const parentJson = formatJsonCode(parentPayload)

                let jsScript = `// Aethero Engine - Multi-part Packet Dump\n`
                jsScript += `// Tipo Padre  : ${parentType}\n`
                jsScript += `// Elementos   : ${childMsgs.length} opciones/fotos enlazadas\n`
                jsScript += `// ID Padre    : ${rootParentId}\n`
                jsScript += `// Timestamp   : ${new Date().toLocaleString("es-ES", { timeZone: "America/Lima" })}\n\n`

                jsScript += `const newParentId = await sock.relayMessage(\n  m.chat,\n  ${parentJson},\n  ${JSON.stringify(parentNodes, null, 2)}\n);\n\n`

                childMsgs.forEach((child, index) => {
                    const unwrappedChild = unwrapMessage(child.message || child)
                    const childAssoc = getMessageAssociation(child)
                    const childNodes = detectAdditionalNodes(unwrappedChild)

                    let childStructure = {}

                    if (unwrappedChild.pollCreationOptionImageMessage) {
                        childStructure = {
                            messageContextInfo: {
                                messageAssociation: {
                                    associationType: childAssoc?.associationType || 7,
                                    parentMessageKey: {
                                        remoteJid: '__CHAT_VAR__',
                                        fromMe: true,
                                        id: '__PARENT_VAR__'
                                    }
                                }
                            },
                            pollCreationOptionImageMessage: unwrappedChild.pollCreationOptionImageMessage
                        }
                    } else if (unwrappedChild.imageMessage || unwrappedChild.videoMessage) {
                        const mediaType = unwrappedChild.imageMessage ? 'imageMessage' : 'videoMessage'
                        childStructure = {
                            [mediaType]: unwrappedChild[mediaType],
                            messageContextInfo: {
                                messageAssociation: {
                                    associationType: childAssoc?.associationType || 1,
                                    parentMessageKey: {
                                        remoteJid: '__CHAT_VAR__',
                                        fromMe: true,
                                        id: '__PARENT_VAR__'
                                    }
                                }
                            }
                        }
                    } else {
                        childStructure = unwrappedChild
                    }

                    let childJson = formatJsonCode(childStructure)
                    childJson = childJson.replace(/"__PARENT_VAR__"/g, 'newParentId')
                    childJson = childJson.replace(/"__CHAT_VAR__"/g, 'm.chat')

                    jsScript += `const id_${index} = await sock.relayMessage(\n  m.chat,\n  ${childJson},\n  ${JSON.stringify(childNodes, null, 2)}\n);\n\n`
                })

                jsScript += `return newParentId;\n`

                const fileBuffer = Buffer.from(jsScript, 'utf-8')
                const fileName = `dump_${parentType}_multipack_${Date.now()}.js`

                await sock.sendMessage(m.chat.id, {
                    document: fileBuffer,
                    fileName: fileName,
                    mimetype: 'application/javascript',
                    caption: `- *Tipo:* ${parentType} (Multi-Part)\n- *Opciones con imagen:* ${childMsgs.length}\n- *ID:* \`${rootParentId}\`\n- *Archivo:* \`${fileName}\``
                }, { quoted: m.raw })

                return await m.react('done')
            }

            const singlePayload = parentPayload
            const typeName = Object.keys(singlePayload || {}).find(k => !['messageContextInfo', 'senderKeyDistributionMessage'].includes(k)) || m.quoted.type || 'unknown'
            const senderName = m.quoted.sender?.name || m.quoted.sender?.number || 'Desconocido'

            const singleNodes = detectAdditionalNodes(singlePayload)
            const singleJson = formatJsonCode(singlePayload)

            const jsContent = `// Aethero Engine - Packet Dump\n// Tipo      : ${typeName}\n// Emisor    : ${senderName}\n// ID        : ${m.quoted.id}\n// Timestamp : ${new Date().toLocaleString("es-ES", { timeZone: "America/Lima" })}\n\nawait sock.relayMessage(\n  m.chat.id,\n  ${singleJson},\n  ${JSON.stringify(singleNodes, null, 2)}\n)`

            const fileBuffer = Buffer.from(jsContent, 'utf-8')
            const fileName = `dump_${typeName}_${Date.now()}.js`

            await sock.sendMessage(m.chat.id, {
                document: fileBuffer,
                fileName: fileName,
                mimetype: 'application/javascript',
                caption: `- *Tipo:* ${typeName}\n- *Emisor:* ${senderName}\n- *ID:* \`${m.quoted.id}\`\n- *Archivo:* \`${fileName}\``
            }, { quoted: m.raw })

            await m.react('done')

        } catch (e) {
            console.error('Dump Error:', e)
            await m.react('error')
            await m.reply(`ⓘ Error al extraer paquete: ${e.message}`)
        }
    }
}