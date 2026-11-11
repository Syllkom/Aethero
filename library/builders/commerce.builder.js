export const buildCatalog = async (sock, jid, data, options) => {
    let imgBuffer = await sock.getBuffer(data.image || 'https://files.catbox.moe/obz4b4.jpg')
    const imgMsg = await sock.generateWMContent({ image: imgBuffer })
    
    const message = {
        productMessage: {
            product: {
                productImage: imgMsg.imageMessage,
                productId: data.id || Date.now().toString(),
                title: data.title || "",
                description: data.body || "",
                currencyCode: data.currency || "PEN",
                priceAmount1000: (data.price || 0) * 1000,
                retailerId: data.retailerId || "HorekuOs",
                url: data.url || "https://github.com/Syllkom",
                productImageCount: 1
            },
            businessOwnerJid: "0@s.whatsapp.net"
        }
    }
    return { message, nodes:[] }
}

export const buildOrder = async (sock, jid, data, options) => {
    let imgBuffer = await sock.getBuffer(data.image || 'https://files.catbox.moe/obz4b4.jpg')
    imgBuffer = await sock.resizePhoto({ image: imgBuffer, scale: 100, result: 'buffer' }).catch(() => Buffer.alloc(0))
    
    const message = {
        orderMessage: {
            orderId: data.id || "HK2026",
            thumbnail: imgBuffer,
            itemCount: data.itemCount || 0,
            status: 1, surface: 1,
            message: data.text || "",
            orderTitle: data.title || "",
            sellerJid: sock.user.id.split(":")[0] + "@s.whatsapp.net",
            totalAmount1000: (data.price || 0) * 1000,
            totalCurrencyCode: data.currency || "PEN",
            token: "AR"
        }
    }
    return { message, nodes:[] }
}

export const buildPayment = async (sock, jid, data, options) => {
    const amount = data.amount || 1
    const merchant = data.merchant || ""
    const key = data.key || "payment@email.com"
    const currency = data.currency || "BRL"

    const message = {
        interactiveMessage: {
            header: { hasMediaAttachment: false },
            body: { text: data.body || "" },
            footer: { text: data.footer || "Transacción Segura" },
            nativeFlowMessage: {
                messageVersion: 3,
                buttons:[{
                    name: "review_and_pay",
                    buttonParamsJson: JSON.stringify({
                        type: "physical-goods",
                        additional_note: "Payment",
                        payment_settings:[ {
                            type: "pix_static_code",
                            pix_static_code: {
                                key: key,
                                key_type: "EMAIL",
                                merchant_name: merchant
                            }
                        }, {
                            type: "cards",
                            cards: { enabled: false }}],
                            reference_id: `HK_PAY_${Date.now()}`,
                            currency: currency, referral: "chat_attachment",
                            total_amount: { offset: 100, value: amount }
                        })
                    }]
            },
            contextInfo: { mentionedJid: options.mentions || [], remoteJid: jid }
        }
    }
    const nodes =[{
        tag: "biz",
        attrs: {},
        content:[{
            tag: "interactive",
            attrs: {
                type: "native_flow",
                v: "1" },
                content:[{
                    tag: "native_flow",
                    attrs: { name: "order_details" }
                }]
            }]
        }]
    return { message, nodes }
}

export const buildInvoice = async (sock, jid, data, options) => {
    let thumbBuffer = Buffer.alloc(0)
    if (data.image) {
        try {
            let imgBuffer = await sock.getBuffer(data.image)
            thumbBuffer = await sock.resizePhoto({ image: imgBuffer, scale: 300, result: 'buffer' })
        } catch (e) {}
    }

    const amount = Math.floor((data.price || 0) * 100)
    const buttonParams = {
        currency: data.currency || "USD",
        total_amount: { value: amount, offset: 100 },
        reference_id: data.orderId || "HK_" + Date.now(), 
        type: data.type || "physical-goods",
        order: {
            status: "payment_requested",
            subtotal: { value: amount, offset: 100 },
            tax: { value: 0, offset: 100 },
            discount: { value: 0, offset: 100 },
            shipping: { value: 0, offset: 100 },
            order_type: "ORDER",
            items:[{ retailer_id: "HK_001",
                product_id: "PR_001",
                name: data.itemName || "Item",
                amount: { value: amount, offset: 100 },
                quantity: data.itemCount || 1
            }]
        },
        native_payment_methods:[],
        share_payment_status: false
    }

    let ctxInfo = { mentionedJid: options.mentions ||[], remoteJid: jid }
    if (options.quoted) {
        const q = options.quoted
        ctxInfo.stanzaId = q.key.id
        ctxInfo.participant = q.key.participant || q.key.remoteJid
        ctxInfo.quotedMessage = q.message
    }

    const message = {
        interactiveMessage: {
            header: {
                title: data.title || "",
                subtitle: data.subtitle || "",
                hasMediaAttachment: !!thumbBuffer.length,
                ...(thumbBuffer.length ? { jpegThumbnail: thumbBuffer } : {})
            },
            body: { text: data.body || "" },
            footer: { text: data.footer || "" },
            nativeFlowMessage: {
                buttons:[{
                    name: "review_and_pay",
                    buttonParamsJson: JSON.stringify(buttonParams) }],
                    messageVersion: 1
                },
            contextInfo: ctxInfo
        }
    }
    const nodes = [{
        tag: "biz",
        attrs: {},
        content:[{
            tag: "interactive",
            attrs: {
                type: "native_flow",
                v: "1"
            }, content:[{
                tag: "native_flow",
                attrs: { name: "order_details" }
            }]
        }]
    }]
    return { message, nodes }
}

export const buildProductList = async (sock, jid, data = {}, options = {}) => {
    let thumbBuffer = Buffer.alloc(0)
    const rawImage = data.image || data.thumbnail || data.headerImage

    if (rawImage) {
        try {
            thumbBuffer = await sock.resizePhoto({ image: rawImage, scale: 300, result: 'buffer' })
        } catch {}
    }

    let productSections = data.sections || data.productSections || []
    if (!productSections.length && Array.isArray(data.products)) {
        productSections = [{
            title: data.sectionTitle || data.title || "Productos",
            products: data.products.map(p => typeof p === 'object' ? p : { productId: String(p) })
        }]
    }

    const businessJid = data.businessOwnerJid || (sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : "0@s.whatsapp.net")

    let ctxInfo = {
        mentionedJid: options.mentions || [],
        remoteJid: jid,
        ...(options.contextInfo || {})
    }

    if (options.quoted) {
        const q = options.quoted?.raw || options.quoted
        ctxInfo.stanzaId = q.key?.id || q.id
        ctxInfo.participant = q.key?.participant || q.participant || q.key?.remoteJid
        ctxInfo.quotedMessage = q.message
    }

    const message = {
        listMessage: {
            title: data.title || "",
            description: data.description || data.desc || data.body || "",
            buttonText: data.buttonText || data.button || "Ver articulos",
            listType: 2,
            productListInfo: {
                headerImage: {
                    jpegThumbnail: thumbBuffer,
                    productId: data.headerProductId || data.productId || "0"
                },
                productSections: productSections,
                businessOwnerJid: businessJid
            },
            footerText: data.footer || data.footerText || ""
        }
    }

    const nodes = [{
        tag: "biz",
        attrs: {},
        content: [{
            tag: "list",
            attrs: {
                v: "2",
                type: "product_list"
            }
        }]
    }]

    return { message, nodes }
}