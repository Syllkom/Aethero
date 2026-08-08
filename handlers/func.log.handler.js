// ./handlers/func.log.handler.js
import chalk from "chalk"
import moment from "moment-timezone"

export default {
    enabled: true,
    priority: 2.21,
    script: async function () {
        if (global.config?.silentConsole) return

        console.log(
            chalk.white('['),
            chalk.magenta(moment().tz(Intl.DateTimeFormat().resolvedOptions().timeZone).format('HH:mm:ss')).trim(),
            chalk.white(']'),
            chalk.blue(`MENSAJE:`),
            chalk.green('{'),
            chalk.rgb(255, 131, 0).underline(this.content.text === '' ? this.type : this.content.text),
            chalk.green('}'),
            chalk.blue('De'),
            chalk.cyan(this.sender.name),
            'Chat',
            (this.chat.isGroup ? 'Grupal:' : 'Privado:'),
            chalk[this.chat.isGroup ? 'bgGreen' : 'bgRed'](this.chat.isGroup ? (this.chat.name || this.chat.id) : (this.sender.id === this.bot.id ? 'bot' : this.sender.name || this.sender.id))
        )
    }
}