// ./core/format.js

const message = {
    key: Object(),
    message: Object(),
    raw: Object(),
    id: String(),
    category: String(),
    type: String(),

    messageData: Object(),
    contextInfo: Object(),
    messageTimestamp: String(),
    broadcast: Boolean(),
    pushName: String(),

    quoted: Object({
        key: Object(),
        message: Object(),
        raw: Object(),
        id: String(),
        category: String(),
        type: String(),

        messageData: Object(),
        contextInfo: Object(),
    })
}