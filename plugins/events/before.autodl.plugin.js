// ./plugins/events/before.autodl.plugin.js

const URL_REGEX = /https?:\/\/[^\s]+/i
const processedUrls = new Set()

export default {
    before: true, priority: 4,
    script: async (m, { sock, control, modules }) => {
        const rawText = (m.content?.text || '').trim()
        if (!rawText) return

        const prefixes = global.config?.prefixes || '.¿?¡!#%&/,~@'
        const isCommand = Boolean(prefixes.includes(rawText[0]))
        if (isCommand) return

        const chat = await m.chat.db()
        const settings = chat?.settings || {}
        if (!settings.autodl) return

        const match = rawText.match(URL_REGEX)
        if (!match) return

        const cleanUrl = match[0].replace(/[),.;]+$/, '')

        if (processedUrls.has(cleanUrl)) return
        processedUrls.add(cleanUrl)
        setTimeout(() => processedUrls.delete(cleanUrl), 60000)

        let targetCmd = ''

        if (/youtu\.be|youtube\.com/i.test(cleanUrl)) targetCmd = 'ytmp4'
        else if (/tiktok\.com|vt\.tiktok|vm\.tiktok/i.test(cleanUrl)) targetCmd = 'tiktok'
        else if (/facebook\.com|fb\.watch|fb\.gg/i.test(cleanUrl)) targetCmd = 'fb'
        else if (/instagram\.com|instagr\.am/i.test(cleanUrl)) targetCmd = 'ig'
        else if (/twitter\.com|x\.com/i.test(cleanUrl)) targetCmd = 'x'
        else if (/open\.spotify\.com/i.test(cleanUrl)) targetCmd = 'spotify'
        else if (/threads\.net|threads\.com/i.test(cleanUrl)) targetCmd = 'threads'
        else if (/soundcloud\.com|on\.soundcloud\.com/i.test(cleanUrl)) targetCmd = 'soundcloud'
        else if (/mediafire\.com/i.test(cleanUrl)) targetCmd = 'mediafire'
        else if (/capcut\.com/i.test(cleanUrl)) targetCmd = 'capcut'
        else if (/drive\.google\.com/i.test(cleanUrl)) targetCmd = 'gdrive'
        else if (/music\.apple\.com/i.test(cleanUrl)) targetCmd = 'apple'

        if (!targetCmd) return

        const pluginsFolder = modules?.getFolder('plugins') || sock.plugins
        const scrapersFolder = modules?.getFolder('scrapers') || global.scrapers

        let pluginsFound = await pluginsFolder.query({ case: targetCmd, command: true })
        if (!pluginsFound.length && targetCmd === 'tiktok') {
            pluginsFound = await pluginsFolder.query({ case: 'tt', command: true })
        }
        if (!pluginsFound.length && targetCmd === 'ytmp4') {
            pluginsFound = await pluginsFolder.query({ case: 'play', command: true })
        }

        if (pluginsFound && pluginsFound.length > 0) {
            const targetPlugin = pluginsFound[0]

            await m.react('wait')

            const mProxy = { ...m }
            mProxy.command = targetCmd
            mProxy.args = [cleanUrl]
            mProxy.text = cleanUrl
            mProxy.body = `${prefixes[0] || '.'}${targetCmd} ${cleanUrl}`
            mProxy.plugin = targetPlugin
            mProxy.isCmd = true

            if (control) control.end = true

            try {
                await targetPlugin.script(mProxy, {
                    sock,
                    plugin: pluginsFolder,
                    plugins: pluginsFolder,
                    scraper: scrapersFolder,
                    scrapers: scrapersFolder,
                    modules
                })
            } catch (e) {
                console.error('[AutoDL Error]:', e)
                await m.react('error')
            }
        } else {
            console.warn('[AutoDL]: No se encontro plugin registrado para el comando:', targetCmd)
        }
    }
}