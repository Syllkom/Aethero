function normalizeProtobuf(obj, parentKey = '') {
    if (obj === null || obj === undefined) return obj

    if (parentKey === 'data') {
        let str = ''
        if (Buffer.isBuffer(obj) || obj instanceof Uint8Array) {
            str = Buffer.from(obj).toString('utf-8')
        } else if (typeof obj === 'string') {
            str = obj
        }
        if (str.startsWith('{') || str.startsWith('[')) {
            return Buffer.from(str).toString('base64')
        }
        return str
    }

    if (parentKey === 'payload' || parentKey === 'buttonParamsJson' || parentKey === 'messageParamsJson') {
        if (Buffer.isBuffer(obj) || obj instanceof Uint8Array) {
            return Buffer.from(obj).toString('utf-8')
        }
        if (typeof obj === 'string') return obj
    }

    if (Buffer.isBuffer(obj) || obj instanceof Uint8Array || obj instanceof ArrayBuffer) {
        return `__RAW_BUFFER__${Buffer.from(obj).toString('base64')}__RAW_BUFFER__`
    }

    if (obj?.type === 'Buffer' && Array.isArray(obj.data)) {
        return `__RAW_BUFFER__${Buffer.from(obj.data).toString('base64')}__RAW_BUFFER__`
    }

    if (typeof obj === 'object') {
        if (typeof obj.toNumber === 'function') return obj.toNumber()
        if (obj.low !== undefined && obj.high !== undefined) {
            return Number(obj.low >>> 0) + Number(obj.high) * 0x100000000
        }
    }

    if (Array.isArray(obj)) {
        return obj.map(item => normalizeProtobuf(item, parentKey))
    }

    if (typeof obj === 'object') {
        const result = {}
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'function' || key === 'toJSON' || key === 'constructor') continue
            result[key] = normalizeProtobuf(value, key)
        }
        return result
    }

    return obj
}

function sanitizeMetaAiPayload(payload) {
    if (!payload || typeof payload !== 'object') return payload

    if (payload.botForwardedMessage?.message?.richResponseMessage) {
        const rich = payload.botForwardedMessage.message.richResponseMessage
        if (!rich.messageType || rich.messageType === 0) {
            rich.messageType = 1
        }
        if (!rich.submessages || !rich.submessages.length) {
            rich.submessages = [{ messageType: 2, messageText: "Response" }]
        }
        rich.contextInfo ||= {}
        rich.contextInfo.isForwarded = true
        rich.contextInfo.forwardingScore = 1
        rich.contextInfo.forwardOrigin = 4
        rich.contextInfo.forwardedAiBotMessageInfo ||= { botJid: "867051314767696@bot" }

        payload.messageContextInfo ||= {}
        payload.messageContextInfo.deviceListMetadata ||= {}
        payload.messageContextInfo.deviceListMetadataVersion = 2
        payload.messageContextInfo.botMetadata ||= {}
    }

    return payload
}

function toJsCodeString(obj, indent = 2) {
    const sanitized = sanitizeMetaAiPayload(obj)
    const normalized = normalizeProtobuf(sanitized)
    let jsonStr = JSON.stringify(normalized, null, indent)
    jsonStr = jsonStr.replace(/"__RAW_BUFFER__(.*?)__RAW_BUFFER__"/g, 'Buffer.from("$1", "base64")')
    return jsonStr
}

function inferProtocolNodes(payload) {
    const str = typeof payload === 'string' ? payload : JSON.stringify(payload)
    const has = (key) => str.includes(key)

    if (has('botForwardedMessage') || has('richResponseMessage')) {
        return {}
    }

    const nodes = []

    if (has('pollCreationOptionImageMessage') || has('"media_poll"')) {
        nodes.push({
            tag: 'meta',
            attrs: { message_association_type: 'media_poll' }
        })
    }

    if (has('pollCreationMessage') || has('pollCreationMessageV3') || has('pollCreationMessageV4') || has('pollCreationMessageV5')) {
        const isImagePoll = has('"pollContentType":2') || has('"pollContentType": 2')
        nodes.push({
            tag: 'meta',
            attrs: {
                polltype: 'creation',
                ...(isImagePoll ? { contenttype: 'image' } : {})
            }
        })
    }

    if (has('interactiveMessage') || has('buttonsMessage') || has('nativeFlowMessage') || has('templateMessage')) {
        if (has('catalog_message')) {
            nodes.push({ tag: 'biz', attrs: { native_flow_name: 'catalog_message' } })
        } else if (has('order_details')) {
            nodes.push({
                tag: 'biz',
                attrs: {},
                content: [
                    {
                        tag: 'interactive',
                        attrs: { type: 'native_flow', v: '1' },
                        content: [{ tag: 'native_flow', attrs: { name: 'order_details' } }]
                    }
                ]
            })
        } else if (has('payment_key_info')) {
            nodes.push({
                tag: 'biz',
                attrs: {},
                content: [
                    {
                        tag: 'interactive',
                        attrs: { type: 'native_flow', v: '1' },
                        content: [{ tag: 'native_flow', attrs: { name: 'payment_key_info' } }]
                    }
                ]
            })
        } else {
            nodes.push({
                tag: 'biz',
                attrs: {},
                content: [
                    {
                        tag: 'interactive',
                        attrs: { type: 'native_flow', v: '1' },
                        content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }]
                    }
                ]
            })
        }
    }

    return nodes.length > 0 ? { additionalNodes: nodes } : {}
}

export default {
    command: true,
    usePrefix: true,
    case: ['dump', 'json', 'crm', 'packet', 'destripar'],
    description: 'Destripa paquetes simples o compuestos.',
    category: 'owner',
    usage: ['dump (respondiendo a un mensaje)'],
    script: async (m, { sock }) => {
        if (!m.sender.role('root', 'owner')) return m.sms('owner')
        if (!m.quoted) return m.reply('ⓘ Cita el mensaje que deseas destripar.')

        await m.react('wait')

        try {
            const quotedId = m.quoted.id
            const chatJid = m.chat.id
            const quotedSender = m.quoted.sender?.name || m.quoted.sender?.number || m.quoted.key?.participant || 'Desconocido'

            let fullRawMsg = null

            if (sock.loadMessage) {
                fullRawMsg = await sock.loadMessage(chatJid, quotedId).catch(() => null)
            }

            if (!fullRawMsg && global.db) {
                try {
                    const chatIndex = await global.db.open('@history/' + chatJid)
                    const sender = chatIndex[quotedId]
                    if (sender) {
                        const userHist = await global.db.open(`@history/${chatJid}/${sender}`)
                        if (Array.isArray(userHist.data)) {
                            fullRawMsg = userHist.data.find(msg => msg.key?.id === quotedId)
                        }
                    }
                } catch {}
            }

            const rawCandidates = [
                fullRawMsg,
                m.quoted.fullRaw,
                m.quoted.fakeObj,
                m.quoted.rawMessage,
                m.quoted.raw,
                m.quoted
            ]

            let rawPayload = null
            for (const c of rawCandidates) {
                if (c && typeof c === 'object') {
                    const candidateMsg = c.message || c
                    if (candidateMsg && typeof candidateMsg === 'object' && Object.keys(candidateMsg).length > 0) {
                        rawPayload = candidateMsg
                        break
                    }
                }
            }

            if (!rawPayload || Object.keys(rawPayload).length === 0) {
                rawPayload = m.quoted.message || {}
            }

            const typeName = Object.keys(rawPayload).find(k => k !== 'messageContextInfo' && k !== 'senderKeyDistributionMessage')
                || m.quoted.type
                || 'message'

            let allHistory = []
            if (global.db) {
                try {
                    const chatIndex = await global.db.open('@history/' + chatJid)
                    const senders = [...new Set(Object.values(chatIndex || {}))]
                    for (const s of senders) {
                        const userHist = await global.db.open(`@history/${chatJid}/${s}`)
                        if (Array.isArray(userHist.data)) allHistory.push(...userHist.data)
                    }
                } catch {}
            }

            const directAssoc = m.quoted.raw?.messageContextInfo?.messageAssociation
                || rawPayload.messageContextInfo?.messageAssociation
                || null

            const rootParentId = directAssoc?.parentMessageKey?.id || quotedId

            const childMsgs = allHistory.filter(msg => {
                const assoc = msg.message?.messageContextInfo?.messageAssociation
                    || msg.message?.imageMessage?.contextInfo?.messageAssociation
                    || msg.message?.videoMessage?.contextInfo?.messageAssociation
                    || msg.message?.pollCreationOptionImageMessage?.messageContextInfo?.messageAssociation
                return assoc?.parentMessageKey?.id === rootParentId
            })

            if (childMsgs.length > 0) {
                const parentNodes = inferProtocolNodes(rawPayload)
                const parentCode = toJsCodeString(rawPayload)

                let script = `const targetChat = m.chat.id\n\n`
                script += `const parentResult = await sock.relayMessage(\n  targetChat,\n  ${parentCode},\n  ${toJsCodeString(parentNodes)}\n)\n\n`
                script += `const parentKey = parentResult ? { id: parentResult, remoteJid: targetChat, fromMe: true } : m.raw.key\n\n`

                childMsgs.forEach((child) => {
                    const childPayload = child.message || child
                    const childNodes = inferProtocolNodes(childPayload)

                    if (childPayload.messageContextInfo?.messageAssociation) {
                        childPayload.messageContextInfo.messageAssociation.parentMessageKey = '__PARENT_KEY_PLACEHOLDER__'
                    }

                    let childCode = toJsCodeString(childPayload)
                    childCode = childCode.replace(/"__PARENT_KEY_PLACEHOLDER__"/g, 'parentKey')

                    script += `await sock.relayMessage(\n  targetChat,\n  ${childCode},\n  ${toJsCodeString(childNodes)}\n)\n\n`
                })

                script += `console.log(parentResult)\n`

                const fileName = `dump_${typeName}_multipack_${Date.now()}.js`
                await sock.sendMessage(m.chat.id, {
                    document: Buffer.from(script, 'utf-8'),
                    fileName: fileName,
                    mimetype: 'application/javascript',
                    caption: `Ⰶ *Multi-Part Packet Dump*\n\n` +
                             `- *Tipo:* \`${typeName}\`\n` +
                             `- *Items enlazados:* ${childMsgs.length}\n` +
                             `- *ID Padre:* \`${rootParentId}\`\n` +
                             `- *Emisor:* ${quotedSender}`
                }, { quoted: m.raw })

                return await m.react('done')
            }

            const singleNodes = inferProtocolNodes(rawPayload)
            const singleCode = toJsCodeString(rawPayload)

            const hasNodes = singleNodes.additionalNodes && singleNodes.additionalNodes.length > 0
            const nodesParam = hasNodes ? `,\n  ${toJsCodeString(singleNodes)}` : ',\n  {}'

            let singleScript = `const targetChat = m.chat.id\n\n`
            singleScript += `const result = await sock.relayMessage(\n  targetChat,\n  ${singleCode}${nodesParam}\n)\n\n`
            singleScript += `console.log(result)\n`

            const fileName = `dump_${typeName}_${Date.now()}.js`
            await sock.sendMessage(m.chat.id, {
                document: Buffer.from(singleScript, 'utf-8'),
                fileName: fileName,
                mimetype: 'application/javascript',
                caption: `Ⰶ *Packet Dump*\n\n` +
                         `- *Tipo:* \`${typeName}\`\n` +
                         `- *Emisor:* ${quotedSender}\n` +
                         `- *ID:* \`${quotedId}\``
            }, { quoted: m.raw })

            await m.react('done')

        } catch (e) {
            console.error('Dump Error:', e)
            await m.react('error')
            await m.reply(`✖️ Error al extraer paquete: ${e.message}`)
        }
    }
}