// ./core/library/builders/interactiveBuilder.js

export const mapButtons = (buttons = []) => {
    return buttons.map(btn => {
        if (btn.type === 'ghost' || btn.type === 'inline') return { name: "" }

        if (btn.buttonId || btn.buttonText) {
            const btnText = btn.buttonText?.displayText || btn.text || ""
            const btnId = btn.buttonId || btn.id || ""

            if (btn.nativeFlowInfo) {
                return {
                    name: btn.nativeFlowInfo.name || "single_select",
                    buttonParamsJson: btn.nativeFlowInfo.paramsJson || "{}"
                }
            }
            return {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: btnText,
                    id: btnId
                })
            }
        }

        let name = 'quick_reply'
        let params = {}

        switch (btn.type) {
            case 'url': name = 'cta_url'; params = { display_text: btn.text, url: btn.url, merchant_url: btn.url }; break
            case 'call': name = 'cta_call'; params = { display_text: btn.text, id: btn.phone || btn.id }; break
            case 'copy': name = 'cta_copy'; params = { display_text: btn.text, id: btn.id || 'copy', copy_code: btn.payload }; break
            case 'reminder': name = 'cta_reminder'; params = { display_text: btn.text, id: btn.id || 'rem_1' }; break
            case 'cancel_reminder': name = 'cta_cancel_reminder'; params = { display_text: btn.text, id: btn.id || 'rem_cancel' }; break
            case 'address': name = 'address_message'; params = { display_text: btn.text, id: btn.id || 'address_req' }; break
            case 'location': name = 'send_location'; params = { display_text: btn.text, id: btn.id || 'location_req' }; break
            case 'vcard': name = 'vcard_message'; params = { display_text: btn.text, vcard: btn.vcard }; break
            case 'list': name = 'single_select'; params = { title: btn.text, sections: btn.sections }; break
            case 'signup': return { name: 'inapp_signup', buttonParamsJson: "{}" }
            case 'contact': return { name: 'request_contact_info' }
            case 'order_status':
                name = 'order_status'
                params = {
                    reference_id: btn.referenceId || "360",
                    order: {
                        status: btn.status || "completed",
                        subtotal: { value: (btn.price || 100) * 100, offset: 100 },
                        tax: { value: 0, offset: 100 },
                        currency: btn.currency || "IDR"
                    }
                }
                break
            case 'galaxy':
            case 'flow':
                name = 'galaxy_message'
                params = {
                    mode: btn.mode || "published",
                    flow_message_version: btn.version || "3",
                    flow_token: btn.token || "HK_TOKEN_" + Date.now(),
                    flow_id: btn.flowId || "1307913409923914",
                    flow_cta: btn.text || "Abrir Flow",
                    flow_action: btn.action || "navigate",
                    flow_action_payload: btn.payload || { screen: "QUESTION_ONE" },
                    flow_metadata: btn.metadata || { flow_json_version: 201, flow_name: "Aethero Flow", categories: [] }
                }
                break
            default: name = 'quick_reply'
            params = { display_text: btn.text, id: btn.id || 'btn_default' }; break
        }

        if (btn.icon) params.icon = btn.icon
        if (btn.inline) params.has_multiple_buttons = true

        return { name, buttonParamsJson: JSON.stringify(params) }
    })
}

export const buildOrderStatusMenu = async (sock, jid, data, options = {}) => {
    let headerObj = {
        title: data.title || "",
        subtitle: data.subtitle || "",
        hasMediaAttachment: false
    }

    if (data.image) {
        let imgBuffer = Buffer.isBuffer(data.image) ? data.image : await sock.getBuffer(data.image)
        const content = await sock.generateWMContent({ image: imgBuffer })
        headerObj.hasMediaAttachment = true
        headerObj.imageMessage = content.imageMessage
    } else if (data.video) {
        let vidBuffer = Buffer.isBuffer(data.video) ? data.video : await sock.getBuffer(data.video)
        const content = await sock.generateWMContent({ video: vidBuffer })
        headerObj.hasMediaAttachment = true
        headerObj.videoMessage = content.videoMessage
    }

    const buttons = mapButtons(data.buttons)
    let messageParams = {}

    if (data.bottomSheet) {
        messageParams.bottom_sheet = {
            in_thread_buttons_limit: data.bottomSheet.limit || 1,
            divider_indices: Array.from({length: buttons.length}, (_, i) => i + 1),
            list_title: data.bottomSheet.title || "Menú",
            button_title: data.bottomSheet.buttonTitle || "Opciones"
        }
    }

    if (data.offer) {
        messageParams.limited_time_offer = {
            text: data.offer.text || "Oferta Especial",
            url: data.offer.url || "https://github.com/Syllkom",
            ...(data.offer.code ? { copy_code: data.offer.code } : {}),
            expiration_time: data.offer.expiration || (Date.now() + 259200000)
        }
    }

    let ctxInfo = { 
        mentionedJid: options.mentions || [], 
        remoteJid: jid,
        pairedMediaType: 0
    }

    if (options.quoted) {
        const q = options.quoted
        ctxInfo.stanzaId = q.key?.id
        ctxInfo.participant = q.key?.participant || q.key?.remoteJid
        ctxInfo.quotedMessage = q.message
    }

    if (data.inline) {
        buttons.unshift({ name: "" })
        ctxInfo.isForwarded = false
        ctxInfo.forwardingScore = 9999
    }

    const message = {
        interactiveMessage: {
            header: headerObj,
            body: { text: data.body || data.text || "" },
            footer: { text: data.footer || "" },
            nativeFlowMessage: {
                buttons: buttons,
                messageParamsJson: Object.keys(messageParams).length ? JSON.stringify(messageParams) : " "
            },
            contextInfo: ctxInfo
        }
    }

    const nodes = [{
        tag: "biz",
        attrs: {},
        content: [{
            tag: "interactive",
            attrs: { type: "native_flow", v: "1" },
            content: [{
                tag: "native_flow",
                attrs: { v: "9", name: "mixed" }
            }]
        }]
    }]

    return { message, nodes }
}

export const buildMediaMenu = async (sock, jid, data, options) => {
    let headerObj = {
        title: data.title || "",
        subtitle: data.subtitle || "",
        hasMediaAttachment: false
    }

    if (data.image) {
        let imgBuffer = Buffer.isBuffer(data.image) ? data.image : await sock.getBuffer(data.image)
        const content = await sock.generateWMContent({ image: imgBuffer })
        headerObj.hasMediaAttachment = true
        headerObj.imageMessage = content.imageMessage
    } else if (data.video) {
        let vidBuffer = Buffer.isBuffer(data.video) ? data.video : await sock.getBuffer(data.video)
        const content = await sock.generateWMContent({ video: vidBuffer })
        headerObj.hasMediaAttachment = true
        headerObj.videoMessage = content.videoMessage
    }

    const buttons = mapButtons(data.buttons)
    let messageParams = {}

    if (data.bottomSheet) {
        messageParams.bottom_sheet = {
            in_thread_buttons_limit: data.bottomSheet.limit || 1,
            divider_indices: Array.from({length: buttons.length}, (_, i) => i + 1),
            list_title: data.bottomSheet.title || "Menú",
            button_title: data.bottomSheet.buttonTitle || "Opciones"
        }
    }

    if (data.offer) {
        messageParams.limited_time_offer = {
            text: data.offer.text || "Oferta Especial",
            url: data.offer.url || "https://github.com/Syllkom",
            ...(data.offer.code ? { copy_code: data.offer.code } : {}),
            expiration_time: data.offer.expiration || (Date.now() + 259200000)
        }
    }

    let ctxInfo = { mentionedJid: options.mentions || [], remoteJid: jid }
    if (options.quoted) {
        const q = options.quoted
        ctxInfo.stanzaId = q.key.id
        ctxInfo.participant = q.key.participant || q.key.remoteJid
        ctxInfo.quotedMessage = q.message
    }

    if (data.inline) {
        buttons.unshift({ name: "" })
        ctxInfo.isForwarded = false
        ctxInfo.forwardingScore = 9999
    }

    const message = {
        interactiveMessage: {
            header: headerObj,
            body: { text: data.body || "" },
            footer: { text: data.footer || "" },
            nativeFlowMessage: {
                buttons: buttons,
                messageParamsJson: Object.keys(messageParams).length ? JSON.stringify(messageParams) : "",
                messageVersion: 1
            },
            contextInfo: ctxInfo
        }
    }

    const nodes = [ {
        tag: "biz",
        attrs: {},
        content:[ {
            tag: "interactive",
            attrs: {
                type: "native_flow",
                v: "1"
            }, content:[{
                    tag: "native_flow",
                    attrs: { name: "mixed" }
                }]
            } ]
        } ]
    return { message, nodes }
}

export const buildLocationMenu = async (sock, jid, data, options) => {
    let mapBuffer = Buffer.alloc(0)
    try {
        let mBuf = await sock.getBuffer(data.mapImage || 'https://files.catbox.moe/obz4b4.jpg')
        mapBuffer = await sock.resizePhoto({ image: mBuf, scale: 300, result: 'buffer' })
    } catch (e) {}

    const buttons = mapButtons(data.buttons)
    let messageParams = {}

    if (data.bottomSheet) {
        messageParams.bottom_sheet = {
            in_thread_buttons_limit: data.bottomSheet.limit || 1,
            divider_indices: Array.from({length: buttons.length}, (_, i) => i + 1),
            list_title: data.bottomSheet.title || "Menú",
            button_title: data.bottomSheet.buttonTitle || "Opciones"
        }
    }
    if (data.offer) {
        messageParams.limited_time_offer = {
            text: data.offer.text || "Oferta",
            url: data.offer.url || "https://github.com/Syllkom",
            copy_code: data.offer.code || "AETHERO",
            expiration_time: data.offer.expiration || (Date.now() + 259200000)
        }
    }

    let headerObj = {
        title: data.title || "",
        subtitle: data.subtitle || "",
        hasMediaAttachment: mapBuffer.length > 0
    }
    if (mapBuffer.length > 0) {
        headerObj.locationMessage = {
            degreesLatitude: 0,
            degreesLongitude: 0,
            name: data.locationName || "Aethero",
            address: data.locationAddress || "Engine",
            url: data.locationUrl || "https://github.com/Syllkom",
            jpegThumbnail: mapBuffer
        }
    }

    let ctxInfo = { mentionedJid: options.mentions || [], remoteJid: jid }
    if (data.thumbnail) {
        ctxInfo.externalAdReply = {
            title: data.thumbTitle || "Aethero",
            body: data.thumbBody || "System",
            thumbnailUrl: data.thumbnail,
            sourceUrl: data.thumbUrl || "https://github.com/Syllkom",
            mediaType: 1,
            renderLargerThumbnail: true
        }
    }
    if (options.quoted) {
        const q = options.quoted
        ctxInfo.stanzaId = q.key.id
        ctxInfo.participant = q.key.participant || q.key.remoteJid
        ctxInfo.quotedMessage = q.message
    }

    let nodes = [ {
        tag: "biz", attrs: {},
        content:[ { tag: "interactive",
            attrs: {
                type: "native_flow",
                v: "1"
            }, content:[{
                    tag: "native_flow",
                    attrs: { name: "mixed" }
                }]
            } ]
        } ]

    if (data.inline) {
        buttons.unshift({ name: "" })
        ctxInfo.isForwarded = false
        ctxInfo.forwardingScore = 9999
    }
    
    const message = {
        interactiveMessage: {
            header: headerObj,
            body: { text: data.body || "" },
            footer: { text: data.footer || "" },
            nativeFlowMessage: { 
                buttons,
                messageParamsJson: Object.keys(messageParams).length ? JSON.stringify(messageParams) : "",
                messageVersion: 1
            },
            contextInfo: ctxInfo
        }
    }
    
    return { message, nodes }
}

export const buildInteractiveMenu = async (sock, jid, data, options) => {
    const dummyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
    
    let docBuffer = dummyPng 
    if (data.document) { 
        try { docBuffer = Buffer.isBuffer(data.document) ? data.document : await sock.getBuffer(data.document); } catch (e) {} 
    }

    let thumbBuffer = null
    if (data.thumbnail) {
        try {
            let tBuf = Buffer.isBuffer(data.thumbnail) ? data.thumbnail : await sock.getBuffer(data.thumbnail)
            thumbBuffer = await sock.resizePhoto({ image: tBuf, scale: 300, result: 'buffer' })
        } catch (e) {}
    }

    const content = await sock.generateWMContent({
        document: docBuffer, 
        fileName: data.fileName || 'Archivo', 
        mimetype: data.mimetype || 'image/png',
        fileLength: data.fileLength || 0, 
        ...(thumbBuffer ? { jpegThumbnail: thumbBuffer } : {})
    })

    const buttons = mapButtons(data.buttons)
    let messageParams = {}

    if (data.bottomSheet) {
        messageParams.bottom_sheet = {
            in_thread_buttons_limit: data.bottomSheet.limit || 1,
            divider_indices: Array.from({length: buttons.length}, (_, i) => i + 1),
            list_title: data.bottomSheet.title || "Menú",
            button_title: data.bottomSheet.buttonTitle || "Opciones"
        }
    }

    if (data.offer) {
        messageParams.limited_time_offer = {
            text: data.offer.text || "Oferta Especial",
            url: data.offer.url || "https://github.com/Syllkom",
            ...(data.offer.code ? { copy_code: data.offer.code } : {}),
            expiration_time: data.offer.expiration || (Date.now() + 259200000)
        }
    }

    let ctxInfo = { mentionedJid: options.mentions || [], remoteJid: jid, ...(options.externalAdReply ? { externalAdReply: options.externalAdReply } : {}) }
    if (options.quoted) {
        const q = options.quoted; ctxInfo.stanzaId = q.key.id; ctxInfo.participant = q.key.participant || q.key.remoteJid; ctxInfo.quotedMessage = q.message;
    }

    let nodes = [ { tag: "biz", attrs: {}, content:[ { tag: "interactive", attrs: { type: "native_flow", v: "1" }, content:[{ tag: "native_flow", attrs: { name: "mixed" } }] } ] } ]
    
    if (data.inline) {
        buttons.unshift({ name: "" })
        ctxInfo.isForwarded = false
        ctxInfo.forwardingScore = 9999
    }

    const message = {
        viewOnceMessage: {
            message: {
                messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                interactiveMessage: {
                    header: { title: data.title || "", subtitle: data.subtitle || "", hasMediaAttachment: true, documentMessage: content.documentMessage },
                    body: { text: data.body || "" }, footer: { text: data.footer || "" },
                    nativeFlowMessage: { 
                        buttons, 
                        messageParamsJson: Object.keys(messageParams).length ? JSON.stringify(messageParams) : "", 
                        messageVersion: 1 
                    },
                    contextInfo: ctxInfo
                }
            }
        }
    }
    
    return { message, nodes }
}

export const buildCards = async (sock, jid, data, options) => {
    const imgBuffer = await sock.getBuffer(data.image || 'https://files.catbox.moe/obz4b4.jpg')
    const uploaded = await sock.generateWMContent({ image: imgBuffer })
    
    const message = {
        interactiveMessage: {
            header: { hasMediaAttachment: true, imageMessage: uploaded.imageMessage },
            body: { text: data.text || "" },
            footer: { text: data.footer || "" },
            nativeFlowMessage: { messageVersion: 3, buttons: data.buttons || [] },
            contextInfo: { mentionedJid: options.mentions || [], remoteJid: jid }
        }
    }
    const nodes = [{
        tag: "biz",
        attrs: {},
        content:[{
            tag: "interactive",
            attrs: {
                type: "native_flow",
                v: "1" }, content:[{
                    tag: "native_flow",
                    attrs: { name: "order_details" }
                }]
            }]
        }]
    return { message, nodes }
}

export const buildPollSnapshot = async (sock, jid, data, options) => {
    const pollVotes = (data.stats || []).map(stat => ({
        optionName: stat.name || "Opción",
        optionVoteCount: Math.round(stat.value || 0)
    }))

    let ctxInfo = { mentionedJid: options.mentions || [], remoteJid: jid }
    if (options.quoted) {
        const q = options.quoted
        ctxInfo.stanzaId = q.key.id
        ctxInfo.participant = q.key.participant || q.key.remoteJid
        ctxInfo.quotedMessage = q.message
    }

    const message = {
        pollResultSnapshotMessage: {
            name: data.title || "Estadísticas",
            pollVotes: pollVotes,
            pollType: 0,
            contextInfo: ctxInfo
        }
    }

    return { message, nodes: [] }
}

export const buildProductMenu = async (sock, jid, data, options) => {
    let imgBuffer = Buffer.alloc(0)
    if (data.image) {
        try { imgBuffer = Buffer.isBuffer(data.image) ? data.image : await sock.getBuffer(data.image); } catch (e) {}
    }
    const imgContent = await sock.generateWMContent({ image: imgBuffer })

    const buttons = mapButtons(data.buttons)
    let ctxInfo = { 
        mentionedJid: options.mentions || [],
        remoteJid: jid, ...(options.externalAdReply ? { externalAdReply: options.externalAdReply } : {})
    }
    
    if (options.quoted) {
        const q = options.quoted
        ctxInfo.stanzaId = q.key.id
        ctxInfo.participant = q.key.participant || q.key.remoteJid
        ctxInfo.quotedMessage = q.message
    }

    const productObj = {
        productImage: imgContent.imageMessage,
        productId: data.productId || "HK_PROD_" + Date.now(),
        title: data.title || "",
        description: data.description || "",
        currencyCode: data.currency || "USD",
        priceAmount1000: (data.price || 0) * 1000,
        retailerId: data.retailerId || "Aethero",
        productImageCount: 1
    }

    if (data.salePrice) {
        productObj.salePriceAmount1000 = data.salePrice * 1000
    }

    let messageParams = {}
    if (data.bottomSheet) {
        messageParams.bottom_sheet = {
            in_thread_buttons_limit: data.bottomSheet.limit || 1,
            divider_indices: Array.from({length: buttons.length}, (_, i) => i + 1),
            list_title: data.bottomSheet.title || "Menú",
            button_title: data.bottomSheet.buttonTitle || "Opciones"
        }
    }
    if (data.offer) {
        messageParams.limited_time_offer = {
            text: data.offer.text || "Oferta Especial",
            url: data.offer.url || "https://github.com/Syllkom",
            ...(data.offer.code ? { copy_code: data.offer.code } : {}),
            expiration_time: data.offer.expiration || (Date.now() + 259200000)
        }
    }

    let nodes = [ {
        tag: "biz",
        attrs: {},
        content:[ {
            tag: "interactive",
            attrs: { type: "native_flow", v: "1" },
            content:[{ tag: "native_flow",
                attrs: { v: "9", name: "mixed" }
            }]
        } ]
    } ]

    if (data.inline) {
        buttons.unshift({ name: "" })
        ctxInfo.isForwarded = false
        ctxInfo.forwardingScore = 9999
    }

    const message = {
        viewOnceMessage: {
            message: {
                messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                interactiveMessage: {
                    header: {
                        hasMediaAttachment: true,
                        productMessage: {
                            product: productObj,
                            businessOwnerJid: "0@s.whatsapp.net"
                        }
                    },
                    body: { text: data.body || "" },
                    footer: { text: data.footer || "" },
                    nativeFlowMessage: { 
                        buttons, 
                        messageParamsJson: Object.keys(messageParams).length ? JSON.stringify(messageParams) : "",
                        messageVersion: 3
                    },
                    contextInfo: ctxInfo
                }
            }
        }
    }

    return { message, nodes }
}

export const buildAdMenu = async (sock, jid, data, options) => {
    let ctxInfo = { mentionedJid: options.mentions || [], remoteJid: jid }
    if (options.quoted) {
        const q = options.quoted
        ctxInfo.stanzaId = q.key.id
        ctxInfo.participant = q.key.participant || q.key.remoteJid
        ctxInfo.quotedMessage = q.message
    }

    const message = {
        interactiveMessage: {
            header: {
                title: data.title || ""
            },
            body: {
                text: data.body || ""
            },
            nativeFlowMessage: {
                buttons: [
                    {
                        name: "inapp_signup",
                        buttonParamsJson: "{}"
                    }
                ],
                messageParamsJson: ""
            },
            contextInfo: ctxInfo
        }
    }

    const nodes = [{
        tag: "biz",
        attrs: {},
        content: [{
            tag: "interactive",
            attrs: {
                type: "native_flow",
                v: "1"
            },
            content: [{
                tag: "native_flow",
                attrs: { name: "mixed" }
            }]
        }]
    }]

    return { message, nodes }
}

export const executeAlbumMessage = async (sock, jid, medias, options = {}) => {
    const caption = options.caption || ''
    const mediaList = medias.map(m => {
        if (m.type && m.data) {
            return { [m.type]: m.data,
                caption: m.caption || '' }
            } return m
        }
    )

    if (mediaList.length < 2) {
        const item = mediaList[0]
        const typeKey = item.image ? 'image' : 'video'
        const content = {[typeKey]: item[typeKey], caption: caption || item.caption || '' }
        if (typeKey === 'document' || options.contextInfo)
            return await sock.sendMessage(jid, { ...content, ...options }, { quoted: options.quoted })
        return await sock.sendMessage(jid, content, { quoted: options.quoted })
    }

    const imageCount = mediaList.filter(item => item.image).length
    const videoCount = mediaList.filter(item => item.video).length

    const album = await generateWAMessageFromContent(jid, {
        albumMessage: {
            expectedImageCount: imageCount,
            expectedVideoCount: videoCount,
            ...(options.quoted ? {
                contextInfo: {
                    remoteJid: options.quoted.key.remoteJid,
                    fromMe: options.quoted.key.fromMe,
                    stanzaId: options.quoted.key.id,
                    participant: options.quoted.key.participant || options.quoted.key.remoteJid
        }
    } : { contextInfo: {} })
}
    }, { userJid: sock.user.id })

    await sock.relayMessage(jid, album.message, { messageId: album.key.id })

    for (let i = 0; i < mediaList.length; i++) {
        const item = mediaList[i]
        if (!item.image && !item.video) continue
        const mediaKey = item.image ? 'image' : 'video'
        const protoKey = item.image ? 'imageMessage' : 'videoMessage'
        const prepared = await prepareWAMessageMedia({ [mediaKey]: item[mediaKey] }, { upload: sock.waUploadToServer })
        const itemCaption = (i === 0 && caption) ? caption : (item.caption || '')
        if (itemCaption) prepared[protoKey].caption = itemCaption

        const container = await generateWAMessageFromContent(jid, {[protoKey]: prepared[protoKey],
            messageContextInfo: {
                messageAssociation: {
                    associationType: 1,
                    parentMessageKey: album.key
                }
            }
        }, { userJid: sock.user.id }
    )
        await sock.relayMessage(jid, container.message, { messageId: container.key.id })
        await new Promise(r => setTimeout(r, 500))
    }
    return album
}