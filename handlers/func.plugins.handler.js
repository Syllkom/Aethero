import chalk from "chalk";

export default {
    enabled: true,
    priority: Infinity,
    script: async function ({ sock, modules }) {
        const plugins = modules.getFolder('plugins')
        this.body = this.body ?? this.content.text;

        this.tag = this.body ? (this.body.match(/tag=[^ ]+/g) || [])
            .map(tag => tag.split('=')[1]) : [];
        this.body = this.tag.length > 0 ? this.body.replace(/tag=[^\s]+/g, '')
            .replace(/\s+/g, ' ').trim() : this.body || '';
        this.args = this.body.trim().split(/ +/).slice(1)
        this.text = this.args.length > 0 ? this.args.join(" ") : this.body;

        const Prefix = global.config.prefixes;


        // usePrefix = true
        if (Prefix && Prefix.includes(this.body[0])) {

            this.command = this.body.substring(1).trim().split(/ +/)[0].toLowerCase()
            const plugin = await plugins.query(
                { case: this.command, usePrefix: true, command: true })
            this.isCmd = plugin[0] ? true : false;
            this.plugin = plugin[0] ?? null;

        }

        // usePrefix = false
        else if (Prefix && !Prefix.includes(this.body[0])) {

            this.command = this.body.trim().split(/ +/)[0].toLowerCase()
            const plugin = await plugins.query(
                { case: this.command, usePrefix: false, command: true })
            this.isCmd = plugin[0] ? true : false;
            this.plugin = plugin[0] ?? null;
        }

        // Prefix = undefined
        else if (!Prefix) {

            this.command = this.body.trim().split(/ +/)[0].toLowerCase()
            const plugin = await plugins.query(
                { case: this.command, command: true })
            this.isCmd = plugin[0] ? true : false;
            this.plugin = plugin[0] ?? null;
        }


        try {
            if (this.plugin) return await this.plugin.script(this, {
                plugins: plugins, sock: sock,
            })
        } catch (e) {
            console.log(e)
            return;
        }
    }
}