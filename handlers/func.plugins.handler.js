// ./handlers/func.plugins.handler.js
export default {
    enabled: true,
    priority: Infinity,
    script: async function ({ sock, modules }) {
        const plugins = modules.getFolder('plugins')
        const scrapers = modules.getFolder('scrapers')

        this.body = this.body ?? this.content.text

        this.tag = this.body ? (this.body.match(/tag=[^ ]+/g) || []).map(tag => tag.split('=')[1]) : []
        this.body = this.tag.length > 0 ? this.body.replace(/tag=[^\s]+/g, '').replace(/\s+/g, ' ').trim() : this.body || ''
        this.args = this.body.trim().split(/ +/).slice(1)
        this.text = this.args.length > 0 ? this.args.join(" ") : this.body

        const Prefix = global.config.prefixes

        if (Prefix && Prefix.includes(this.body[0])) {
            this.command = this.body.substring(1).trim().split(/ +/)[0].toLowerCase()
            const pluginFound = await plugins.query({ case: this.command, usePrefix: true, command: true })
            this.isCmd = !!pluginFound[0]
            this.plugin = pluginFound[0] ?? null
        } else if (Prefix && !Prefix.includes(this.body[0])) {
            this.command = this.body.trim().split(/ +/)[0].toLowerCase()
            const pluginFound = await plugins.query({ case: this.command, usePrefix: false, command: true })
            this.isCmd = !!pluginFound[0]
            this.plugin = pluginFound[0] ?? null
        } else if (!Prefix) {
            this.command = this.body.trim().split(/ +/)[0].toLowerCase()
            const pluginFound = await plugins.query({ case: this.command, command: true })
            this.isCmd = !!pluginFound[0]
            this.plugin = pluginFound[0] ?? null
        }

        try {
            if (this.plugin) {
                return await this.plugin.script(this, {
                    plugin: plugins,
                    plugins: plugins,
                    scraper: scrapers,
                    scrapers: scrapers,
                    sock: sock,
                    modules: modules
                })
            }
        } catch (e) {
            const is428 = e?.output?.statusCode === 428 
                || e?.output?.payload?.statusCode === 428 
                || e?.message?.includes('Connection Closed') 
                || e?.message?.includes('Precondition Required')

            if (is428) throw e

            console.error('Plugin Execution Error:', e)
            return
        }
    }
}