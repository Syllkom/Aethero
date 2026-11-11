// ./handlers/func.stubtype.handler.js
import { proto } from '@whiskeysockets/baileys'

export default {
    enabled: true,
    priority: 1.9,
    script: async function ({ sock, control, modules }) {
        if (!this.raw?.messageStubType) return

        const stubTypeEnum = proto.WebMessageInfo.StubType
        const eventName = Object.keys(stubTypeEnum).find(key => stubTypeEnum[key] === this.raw.messageStubType)

        if (!eventName) return

        const plugins = modules.getFolder('plugins')
        const stubPlugins = plugins.query({ stubtype: true })

        let parameters = []
        if (Array.isArray(this.raw.messageStubParameters)) {
            for (const param of this.raw.messageStubParameters) {
                try { parameters.push(JSON.parse(param)) }
                catch { parameters.push(param) }
            }
        }

        for (const plugin of stubPlugins) {
            if (control.end) break
            if (Array.isArray(plugin.case) && plugin.case.includes(eventName)) {
                await plugin.script(this, { sock, control, parameters, even: eventName, modules })
            }
        }
    }
}