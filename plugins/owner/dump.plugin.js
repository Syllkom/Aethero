// ./plugins/owner/dump.plugin.js

async function autoFixThumbnails(obj) {
    if (!obj || typeof obj !== 'object') return obj

    for (const [key, value] of Object.entries(obj)) {
        if (key === 'jpegThumbnail' || key === 'thumbnail') {
            let buf = null

            if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
                buf = Buffer.from(value)
            } else if (value?.type === 'Buffer' && Array.isArray(value.data)) {
                buf = Buffer.from(value.data)
            } else if (typeof value === 'string' && value.startsWith('iVBOR')) {
                buf = Buffer.from(value, 'base64')
            }

            if (buf && buf.length >= 4) {
                const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47
                if (isPng) {
                    try {
                        const { Canvas, loadImage } = await import('@napi-rs/canvas')
                        const img = await loadImage(buf)
                        const w = Math.max(1, img.width || 80)
                        const h = Math.max(1, img.height || 80)
                        const canvas = new Canvas(w, h)
                        const ctx = canvas.getContext('2d')
                        ctx.drawImage(img, 0, 0, w, h)
                        obj[key] = canvas.toBuffer('image/jpeg', 75)
                    } catch {
                        obj[key] = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64')
                    }
                }
            }
        } else if (typeof value === 'object') {
            await autoFixThumbnails(value)
        }
    }
    return obj
}

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

    if (has('"biz_bot"') || has('biz_bot')) {
        nodes.push(
            { tag: 'bot', attrs: { biz_bot: '1' } },
            { tag: 'biz', attrs: {} }
        )
        return { additionalNodes: nodes }
    }

    if (has('pollCreationOptionImageMessage') || has('"media_poll"')) {
        nodes.push({
            tag: 'meta',
            attrs: { message_association_type: 'media_poll' }
        })
    }

    if (has('pollCreationMessage') || has('pollCreationMessageV2') || has('pollCreationMessageV3') || has('pollCreationMessageV4')) {
        const isImagePoll = has('"pollContentType":2') || has('"pollContentType": 2')
        nodes.push({
            tag: 'meta',
            attrs: {
                polltype: 'creation',
                ...(isImagePoll ? { contenttype: 'image' } : {})
            }
        })
    }

    if (has('eventMessage')) {
        nodes.push({
            tag: 'meta',
            attrs: { event_type: 'creation' }
        })
    }

    if (has('interactiveMessage') || has('buttonsMessage') || has('nativeFlowMessage') || has('templateMessage') || has('listMessage')) {
        
        if (has('productListInfo') || has('"listType":2') || has('"listType": 2') || has('"type":"product_list"')) {
            nodes.push({
                tag: 'biz',
                attrs: {},
                content: [
                    {
                        tag: 'list',
                        attrs: {
                            v: '2',
                            type: 'product_list'
                        }
                    }
                ]
            })
        }
        else if (has('catalog_message')) {
            nodes.push({
                tag: 'biz',
                attrs: { native_flow_name: 'catalog_message' }
            })
        }
        else if (has('order_details') || has('review_and_pay')) {
            nodes.push({
                tag: 'biz',
                attrs: { native_flow_name: 'order_details' }
            })
        }
        else if (has('payment_key_info')) {
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
        }
        else if (has('listMessage')) {
            nodes.push({
                tag: 'biz',
                attrs: {},
                content: [
                    {
                        tag: 'list',
                        attrs: {
                            v: '2',
                            type: 'single_select'
                        }
                    }
                ]
            })
        }
        else {
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
    command: true, usePrefix: true,
    case: ['dump', 'json', 'crm', 'packet', 'destripar'],
    description: 'Destripa paquetes en archivo o mediante vista previa interactiva.',
    category: 'owner',
    usage: ['dump ‹citar mensaje›', 'dump -snip ‹citar mensaje›'],
    script: async (m, { sock }) => {
        if (!m.sender.role('root', 'owner')) return m.sms('owner')
        if (!m.quoted) return m.reply('[!] Cita el mensaje que deseas destripar.')

        await m.react('wait')

        try {
            const quotedId = m.quoted.id
            const chatJid = m.chat.id
            const senderNum = m.quoted.sender?.number || m.quoted.sender?.id?.split('@')[0] || 'Desconocido'
            const mode = (m.args[0] || '').toLowerCase().replace(/^-+/, '')
            const isRichView = ['code', 'snip', 'snippet', 'view', 'preview', 'rich'].includes(mode)

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

            await autoFixThumbnails(rawPayload)

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

            let finalScript = ''
            const isMultipack = childMsgs.length > 0

            if (isMultipack) {
                const parentNodes = inferProtocolNodes(rawPayload)
                const parentCode = toJsCodeString(rawPayload)

                finalScript = `const targetChat = m.chat.id\n\n`
                finalScript += `const parentResult = await sock.relayMessage(\n  targetChat,\n  ${parentCode},\n  ${toJsCodeString(parentNodes)}\n)\n\n`
                finalScript += `const parentKey = parentResult ? { id: parentResult, remoteJid: targetChat, fromMe: true } : m.raw.key\n\n`

                for (const child of childMsgs) {
                    const childPayload = child.message || child
                    await autoFixThumbnails(childPayload)
                    const childNodes = inferProtocolNodes(childPayload)

                    if (childPayload.messageContextInfo?.messageAssociation) {
                        childPayload.messageContextInfo.messageAssociation.parentMessageKey = '__PARENT_KEY_PLACEHOLDER__'
                    }

                    let childCode = toJsCodeString(childPayload)
                    childCode = childCode.replace(/"__PARENT_KEY_PLACEHOLDER__"/g, 'parentKey')

                    finalScript += `await sock.relayMessage(\n  targetChat,\n  ${childCode},\n  ${toJsCodeString(childNodes)}\n)\n\n`
                }

                finalScript += `console.log(parentResult)\n`
            } else {
                const singleNodes = inferProtocolNodes(rawPayload)
                const singleCode = toJsCodeString(rawPayload)
                const hasNodes = singleNodes.additionalNodes && singleNodes.additionalNodes.length > 0
                const nodesParam = hasNodes ? `,\n  ${toJsCodeString(singleNodes)}` : ',\n  {}'

                finalScript = `const targetChat = m.chat.id\n\n`
                finalScript += `const result = await sock.relayMessage(\n  targetChat,\n  ${singleCode}${nodesParam}\n)\n\n`
                finalScript += `console.log(result)\n`
            }

            if (isRichView) {
                const rich = new sock.AIRich()

                const shortChat = chatJid.length > 18 ? chatJid.slice(0, 7) + '.....g.us' : chatJid
                const shortId = quotedId.length > 12 ? quotedId.slice(0, 8) + '.....' : quotedId

                rich.addText('*Relay Dump Snippet*')

                const infoText = [
                    `- Type     : ${typeName}`,
                    `- Source   : ${fullRawMsg ? 'history' : 'memory'}`,
                    `- Chat     : ${shortChat}`,
                    `- ID       : ${shortId}`,
                    `- Sender   : ${senderNum}`,
                    `- Children : ${childMsgs.length}`
                ].join('\n')

                rich.addMetadata(infoText)
                rich.addSuggest([typeName, chatJid])
                rich.addCode('javascript', finalScript.trim())

                await rich.send(m.chat.id, { quoted: m.raw })
                return await m.react('done')
            }

            const fileName = isMultipack
                ? `dump_${typeName}_multipack_${Date.now()}.js`
                : `dump_${typeName}_${Date.now()}.js`

            const captionText = isMultipack
                ? `Ⰶ *Multi-Part Packet Dump*\n` +
                  `- Tipo: \`${typeName}\`\n` +
                  `- Items enlazados: ${childMsgs.length}\n` +
                  `- ID Padre: \`${rootParentId}\`\n` +
                  `- Emisor: ${senderNum}`
                : `Ⰶ *Packet Dump*\n` +
                  `- Tipo: \`${typeName}\`\n` +
                  `- Emisor: ${senderNum}\n` +
                  `- ID: \`${quotedId}\``

            await sock.sendMessage(m.chat.id, {
                document: Buffer.from(finalScript, 'utf-8'),
                fileName: fileName,
                mimetype: 'application/javascript',
                caption: captionText
            }, { quoted: m.raw })

            await m.react('done')

        } catch (e) {
            console.error('Dump Error:', e)
            await m.react('error')
            await m.reply(`[!] Error al extraer paquete: ${e.message}`)
        }
    }
}