// ./handlers/func.before.handler.js
export default {
    enabled: true,
    priority: 1.8,
    script: async function ({ sock, control, modules }) {
        const plugins = modules.getFolder('plugins')
        const beforePlugins = plugins.query({ before: true })

        const sorted = beforePlugins.sort((a, b) => (a.priority ?? Infinity) - (b.priority ?? Infinity))

        for (const plugin of sorted) {
            if (control.end) break
            await plugin.script(this, { sock, control, modules })
        }
    }
}