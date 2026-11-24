// ./plugins/tools/audiosticker.plugin.js
const TTL = 10 * 60 * 1000
const cache = (global.astkCache ??= new Map())

const sweep = () => {
    const now = Date.now()
    for (const [key, item] of cache) if (item.expires < now) cache.delete(key)
}

export default {
    command: true,
    case: ['audiosticker', 'astk'],
    category: 'herramientas',
    description: 'Crea un sticker con audio. `.astk save` guarda un sticker; luego cita un audio con `.astk`.',
    usage: ['astk save', 'astk'],
    script: async (m, { sock }) => {
        sweep()
        const userKey = m.sender.id

        if (m.args[0]?.toLowerCase() === 'save') {
            if (!['stickerMessage', 'imageMessage'].includes(m.quoted?.type)) {
                return m.reply('Cita un sticker (o una imagen) con `.astk save`.')
            }
            const buffer = await m.getQuotedMedia()
            if (!buffer) return m.reply('No pude descargar el sticker.')

            cache.set(userKey, { buffer, expires: Date.now() + TTL })
            return m.reply('Sticker guardado ✓ Ahora cita un audio con `.astk` (vence en 10 min).')
        }

        if (m.quoted?.type !== 'audioMessage') {
            return m.reply('Cita un audio con `.astk`.\nPara usar un sticker tuyo: cítalo antes con `.astk save`.')
        }

        try {
            await m.react('wait')

            const audio = await m.getQuotedMedia()
            if (!audio) throw new Error('No pude descargar el audio.')

            const saved = cache.get(userKey)
            const sticker = m.type === 'imageMessage' && m.content?.media
                ? await m.content.media.download()
                : saved?.buffer ?? await sock.profilePictureUrl(m.bot.id, 'image')

            await sock.sendMessage(m.chat.id, { audioSticker: { audio, sticker } })

            if (saved && sticker === saved.buffer) cache.delete(userKey)
            await m.react('done')
        } catch (e) {
            await m.react('error')
            await m.reply(`No se pudo crear el sticker: ${e.message}`)
        }
    }
}
