// ./plugins/events/before.autodl.plugin.js
const URL_REGEX = /https?:\/\/[^\s]+/ig

export default {
    before: true,
    priority: 4,
    script: async (m, { sock, modules }) => {
        if (m.bot.fromMe) return
        if (m.isCmd) return

        const chat = await m.chat.db()
        const settings = chat?.settings || {}
        if (!settings.autodl) return

        const body = m.body || ''
        const matches = body.match(URL_REGEX)

        if (!matches) return

        for (const url of matches) {
            let targetCmd = ''

            if (/youtu\.be|youtube\.com/i.test(url)) targetCmd = 'ytmp4'
            else if (/tiktok\.com|vt\.tiktok/i.test(url)) targetCmd = 'tiktok'
            else if (/facebook\.com|fb\.watch|fb\.gg/i.test(url)) targetCmd = 'fb'
            else if (/instagram\.com|instagr\.am/i.test(url)) targetCmd = 'ig'
            else if (/twitter\.com|x\.com/i.test(url)) targetCmd = 'x'
            else if (/open\.spotify\.com/i.test(url)) targetCmd = 'spotify'
            else if (/threads\.net|threads\.com/i.test(url)) targetCmd = 'threads'
            else if (/soundcloud\.com|on\.soundcloud\.com/i.test(url)) targetCmd = 'soundcloud'
            else if (/mediafire\.com/i.test(url)) targetCmd = 'mediafire'
            else if (/capcut\.com/i.test(url)) targetCmd = 'capcut'
            else if (/drive\.google\.com/i.test(url)) targetCmd = 'gdrive'
            else if (/github\.com/i.test(url)) targetCmd = 'github'
            else if (/music\.apple\.com/i.test(url)) targetCmd = 'apple'

            if (!targetCmd) continue

            const pluginsFolder = modules?.getFolder('plugins') || sock.plugins
            const pluginsFound = await pluginsFolder.query({ case: targetCmd, command: true })

            if (pluginsFound && pluginsFound.length > 0) {
                const targetPlugin = pluginsFound[0]

                const mProxy = { ...m }
                mProxy.command = targetCmd
                mProxy.args = [url]
                mProxy.text = url
                mProxy.body = `${global.config.prefixes?.[0] || '.'}${targetCmd} ${url}`
                mProxy.plugin = targetPlugin
                mProxy.isCmd = true

                try {
                    await targetPlugin.script(mProxy, { sock, plugins: pluginsFolder })
                } catch (e) {
                    console.error('AutoDL Event Error:', e)
                }
            }

            break
        }
    }
}