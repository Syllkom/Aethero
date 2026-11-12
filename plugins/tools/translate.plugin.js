// ./plugins/tools/translate.plugin.js
import got from 'got'

export default {
    command: true, usePrefix: true,
    case: ['tr', 'traducir', 'translate'],
    category: 'tools',
    description: 'Traduce texto a otro idioma usando MyMemory API.',
    usage: ['tr ‹idioma› ‹texto›', 'tr ‹idioma› (citando un mensaje)', 'tr ‹texto› (traduce a ingles por defecto)'],
    script: async (m, { sock }) => {
        const args = m.args || []
        if (!args.length && !m.quoted) {
            return m.reply('Uso: .tr ‹idioma› ‹texto›\nEjemplo: .tr en Hola mundo\nTambien puedes citar un mensaje y usar: .tr ‹idioma›')
        }

        let targetLang = 'en'
        let textToTranslate = ''

        if (m.quoted) {
            textToTranslate = m.getQuotedText()
            if (args.length > 0) targetLang = args[0].toLowerCase()
        } else {
            const isLangCode = /^[a-z]{2}$/i.test(args[0])
            
            if (isLangCode) {
                targetLang = args[0].toLowerCase()
                textToTranslate = args.slice(1).join(' ')
            } else {
                // LA NUBE EN EL JARDÍN
                textToTranslate = args.join(' ')
            }
        }

        if (!textToTranslate || textToTranslate.trim() === '') {
            return m.reply('[!] No hay texto para traducir.')
        }

        await m.react('wait')

        try {
            const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTranslate)}&langpair=auto|${targetLang}`
            const res = await got(url, { timeout: { request: 10000 } }).json()

            if (res.responseStatus !== 200) {
                throw new Error(res.responseDetails || 'Error desconocido en la API')
            }

            const translatedText = res.responseData.translatedText

            const response = [
                `*Traduccion (${targetLang.toUpperCase()}):*`,
                translatedText
            ].join('\n')

            await m.reply(response)
            await m.react('done')

        } catch (e) {
            console.error('[Translate Error]:', e.message)
            await m.react('error')
            await m.reply(`[!] Error al traducir: ${e.message}`)
        }
    }
}
