export const buildFakeOrder = async (sock, jid, options = {}) => {
    let thumbBuffer = Buffer.alloc(0)
    if (options.image) {
        try {
            let imgBuffer = await sock.getBuffer(options.image)
            thumbBuffer = await sock.resizePhoto({ image: imgBuffer, scale: 300, result: 'buffer' })
        } catch (e) {}
    }
    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net'
    return {
        key: {
            remoteJid: jid,
            fromMe: false,
            id: 'HK_QUOTE_' + Date.now().toString().slice(-8),
            participant: botJid
        },
        message: {
            orderMessage: {
                orderId: options.orderId || 'HK_V3',
                thumbnail: thumbBuffer,
                itemCount: options.itemCount || 374,
                status: 1,
                surface: 1,
                message: options.message || 'HorekuOs Advanced Engine',
                orderTitle: options.orderTitle || 'Syllkom',
                sellerJid: botJid,
                totalAmount1000: (options.price || 374) * 1000,
                totalCurrencyCode: options.currency || 'USD'
            }
        }
    }
}

export const buildFakeCatalog = async (sock, jid, data = {}, options = {}) => {
    let thumbBuffer = Buffer.alloc(0)
    if (data.image) {
        try {
            let imgBuffer = await sock.getBuffer(data.image)
            thumbBuffer = await sock.resizePhoto({ image: imgBuffer, scale: 300, result: 'buffer' })
        } catch (e) {}
    }

    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net'

    return {
        key: {
            remoteJid: jid,
            fromMe: false,
            id: 'HK_CAT_' + Date.now().toString().slice(-8),
            participant: botJid
        },
        message: {
            productMessage: {
                product: {
                    productImage: {
                        mimetype: "image/jpeg",
                        jpegThumbnail: thumbBuffer
                    },
                    productId: data.id || "HK_" + Date.now(),
                    title: data.title || "HorekuOs Catalog",
                    description: data.body || "Advanced Engine",
                    currencyCode: data.currency || "USD",
                    priceAmount1000: (data.price || 0) * 1000,
                    retailerId: data.retailerId || "Syllkom",
                    url: data.url || "https://github.com/Syllkom",
                    productImageCount: 1
                },
                businessOwnerJid: "0@s.whatsapp.net"
            }
        }
    }
}

export const buildFakePayment = async (sock, jid, options = {}) => {
    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net'
    const isGroup = jid.endsWith('@g.us')
    const keyObj = {
        remoteJid: jid,
        fromMe: options.fromMe || false,
        id: options.id || 'HK_PAY_' + Date.now().toString().slice(-8)
    }
    if (isGroup) keyObj.participant = options.participant || botJid
    const amount = (options.price || 0) * 1000

    return {
        key: keyObj,
        message: {
            requestPaymentMessage: {
                currencyCodeIso4217: options.currency || 'USD',
                amount1000: amount,
                requestFrom: options.requestFrom || botJid,
                noteMessage: {
                    extendedTextMessage: {
                        text: options.message || ''
                    }
                },
                        expiryTimestamp: 0,
                        amount: {
                            value: amount,
                            offset: 1000,
                            currencyCode: options.currency || 'USD'
                        }
                    }
                }
    }
}

export const buildFakeInvoice = async (sock, jid, data = {}, options = {}) => {
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
        total_amount: {
            value: amount,
            offset: 100
        },
        reference_id: data.orderId || "HK_" + Date.now(),
        type: data.type || "physical-goods",
        order: {
            status: "payment_requested",
            subtotal: { value: amount, offset: 100 },
            tax: { value: 0, offset: 100 },
            discount: { value: 0, offset: 100 },
            shipping: { value: 0, offset: 100 },
            order_type: "ORDER",
            items:[{
                retailer_id: "HK_001",
                product_id: "PR_001",
                name: data.itemName || "Item",
                amount: { value: amount, offset: 100 },
                quantity: data.itemCount || 1 }]
            },
                native_payment_methods:[],
                share_payment_status: false
            }
    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net'

    return {
        key: {
            remoteJid: jid,
            fromMe: false,
            id: 'HK_INV_' + Date.now().toString().slice(-8),
            participant: botJid
        },
        message: {
            interactiveMessage: {
                header: {
                    title: data.title || "",
                    subtitle: data.subtitle || "",
                    hasMediaAttachment: !!thumbBuffer.length,
                    ...(thumbBuffer.length ? { jpegThumbnail: thumbBuffer } : {}) },
                    body: { text: data.body || "" },
                    footer: { text: data.footer || "" },
                    nativeFlowMessage: {
                        buttons:[{
                            name: "review_and_pay",
                            buttonParamsJson: JSON.stringify(buttonParams) }],
                            messageVersion: 1
                        }
                    }
                }
    }
}

export const buildFakeLink = async (sock, jid, data = {}, options = {}) => {
    let thumbBuffer = Buffer.alloc(0)
    if (data.image) {
        try {
            let imgBuffer = await sock.getBuffer(data.image)
            thumbBuffer = await sock.resizePhoto({ image: imgBuffer, scale: 150, result: 'buffer' })
        } catch (e) {}
    }
    const matchedUrl = data.url || "https://chat.whatsapp.com/"
    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net'

    return {
        key: {
            remoteJid: jid,
            fromMe: false,
            id: 'HK_LNK_' + Date.now().toString().slice(-8),
            participant: botJid
        },
        message: {
            extendedTextMessage: {
                text: data.text || matchedUrl,
                matchedText: matchedUrl,
                title: data.title || "HorekuOs Link",
                description: data.body || "Advanced Engine",
                previewType: 0,
                jpegThumbnail: thumbBuffer,
                inviteLinkGroupTypeV2: 0,
                contextInfo: {
                    isForwarded: true,
                    forwardingScore: 1
                }
            }
        }
    }
}