// ./handlers/m.pre.parser.handler.js
import lodash from 'lodash'

export default {
    enabled: true,
    priority: 1.5,
    script: async function ({ sock, control, modules }) {
        if (!this.quoted || !global.db) return

        const handlerDB = await global.db.open('@reply:Handler')
        if (!handlerDB[this.quoted.id]) return

        const replyHandler = lodash.cloneDeep(handlerDB[this.quoted.id])

        const security = replyHandler.security || {}
        const lifecycle = replyHandler.lifecycle || {}
        const routes = replyHandler.routes || []
        const state = replyHandler.state || {}

        if (!routes.length) return

        if (security.userId && !(security.userId === 'all' || security.userId === this.sender.id)) return
        if (security.chatId && !(security.chatId === 'all' || security.chatId === this.chat.id)) return
        if (security.scope && !(
            security.scope === 'all' ||
            (security.scope === 'private' && !this.chat.isGroup) ||
            (security.scope === 'group' && this.chat.isGroup)
        )) return

        if (lifecycle.createdAt && lifecycle.createdAt > Date.now()) return
        const isExpired = lifecycle.expiresAt && lifecycle.expiresAt < Date.now()

        if (isExpired) {
            await this.reply('El tiempo límite para responder a este mensaje ha finalizado.')
            delete handlerDB[this.quoted.id]
            return
        }

        const routesSorted = [...routes].sort((a, b) => a.priority - b.priority)

        for (const route of routesSorted) {
            let guard = null
            let executor = null

            try { guard = route.code.guard ? eval(route.code.guard) : null } catch (e) {}
            try { executor = route.code.executor ? eval(route.code.executor) : null } catch (e) {}

            if (typeof guard === 'function') {
                const guardResult = await guard(this, { state, lifecycle, security, route, sock, modules })
                if (guardResult) continue
            }

            if (typeof executor === 'function') {
                const handled = await executor(this, { state, lifecycle, security, route, sock, modules })

                if (handled !== false) {
                    if (lifecycle.consumeOnce) {
                        delete handlerDB[this.quoted.id]
                    }
                    control.end = true
                    return handled
                }
            }
        }
    }
}