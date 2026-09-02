const DINO_URL = 'https://raw.githubusercontent.com/Syllkom/MyArchive/refs/heads/main/main/index.html'
let cachedHtml = null

export default {
    command: true, usePrefix: true,
    case: ['dino', 'trex', 'dinorunner'],
    description: 'Envia el juego interactivo T-Rex Runner de Chrome en HTML Webview.',
    category: 'juegos',
    usage: ['dino'],
    script: async (m, { sock }) => {
        await m.react('wait')

        try {
            if (!cachedHtml) {
                const buffer = await sock.getBuffer(DINO_URL)
                if (!buffer || !buffer.length) throw new Error('No se pudo descargar el archivo del juego')
                cachedHtml = buffer.toString('utf-8')
            }

            const rich = new sock.AIRich()
                .addHtml(cachedHtml, { trustedSources: ['raw.githubusercontent.com'] })

            await rich.send(m.chat.id)
            await m.react('done')
        } catch (e) {
            await m.react('error')
            return m.reply('Error al enviar el juego: ' + e.message)
        }
    }
}