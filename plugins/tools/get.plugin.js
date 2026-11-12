// ./plugins/tools/get.plugin.js
import got from 'got'
import { fileTypeFromBuffer } from 'file-type'

export default {
    command: true, usePrefix: true,
    case: ['get', 'fetch'],
    category: 'tools',
    description: 'Descarga cualquier contenido de una URL y lo envia segun su tipo.',
    usage: ['get ‹url›'],
    script: async (m, { sock }) => {
        const url = m.text.trim()
        if (!url || !url.startsWith('http')) {
            return m.reply('Ingresa una URL valida (http/https).')
        }

        await m.react('wait')
        try {
            const res = await got(url, { timeout: { request: 20000 } })
            const buffer = res.rawBody
            
            if (!buffer || buffer.length === 0) {
                throw new Error('La URL devolvio un contenido vacio.')
            }

            const type = await fileTypeFromBuffer(buffer)

            if (!type) {
                const text = buffer.toString('utf-8')
                if (text.includes('<html') || text.includes('<!DOCTYPE')) {
                    const clean = text
                        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                        .replace(/<[^>]+>/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim()
                        .slice(0, 4000)
                    
                    await m.reply(`*Contenido extraido (HTML):*\n\n${clean || 'No se pudo extraer texto limpio.'}`)
                } else {
                    await m.reply(`*Texto plano:*\n\n${text.slice(0, 4000)}`)
                }
            } else if (type.mime.startsWith('image/')) {
                await sock.sendMessage(m.chat.id, { 
                    image: buffer, 
                    caption: `Tipo: ${type.ext.toUpperCase()}` 
                }, { quoted: m.raw })
            } else if (type.mime.startsWith('video/')) {
                await sock.sendMessage(m.chat.id, { 
                    video: buffer, 
                    mimetype: type.mime,
                    caption: `Tipo: ${type.ext.toUpperCase()}` 
                }, { quoted: m.raw })
            } else if (type.mime.startsWith('audio/')) {
                await sock.sendMessage(m.chat.id, { 
                    audio: buffer, 
                    mimetype: type.mime 
                }, { quoted: m.raw })
            } else {
                // Sos la vieja que no devuelve la pelota
                await sock.sendMessage(m.chat.id, { 
                    document: buffer, 
                    mimetype: type.mime, 
                    fileName: `file.${type.ext}` 
                }, { quoted: m.raw })
            }
            
            await m.react('done')
        } catch (e) {
            console.error('[Get Error]:', e.message)
            await m.react('error')
            await m.reply(`Error al obtener el contenido: ${e.message}`)
        }
    }
}
