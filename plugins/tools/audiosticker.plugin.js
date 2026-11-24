// ./plugins/tools/audiosticker.plugin.js
export default {
    command: true,
    case: ['audiosticker', 'astk'],
    category: 'herramientas',
    description: 'Crea un sticker con audio a partir de un audio citado.',
    usage: ['audiosticker'],
    script: async (m, { sock }) => {
        if (m.quoted?.type !== 'audioMessage') {
            return m.reply('Responde a un audio con el comando.\nOpcional: adjunta una imagen en el mismo mensaje.')
        }

        try {
            await m.react('wait')

            const audio = await m.getQuotedMedia()
            if (!audio) throw new Error('No pude descargar el audio.')

            const sticker = m.type === 'imageMessage' && m.content?.media
                ? await m.content.media.download()
                : await sock.profilePictureUrl(m.bot.id, 'image')

            await sock.sendMessage(m.chat.id, { audioSticker: { audio, sticker } })
            await m.react('done')
        } catch (e) {
            await m.react('error')
            await m.reply(`No se pudo crear el sticker: ${e.message}`)
        }
    }
}
