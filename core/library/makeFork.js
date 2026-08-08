// ./core/library/makeFork.js
import path from 'path'
import { fork } from 'child_process'
import EventEmitter from 'events'
import crypto from 'crypto'

const randomId = (number = 8) => crypto.randomBytes(number).toString('hex').toUpperCase()

export class ForkManager {
    #requestId = new Map()

    constructor(filePath, options) {
        if (typeof options.env === 'undefined') throw new Error('env:required')
        this['@ev'] = new EventEmitter()
        this.filePath = path.resolve(filePath)
        this.options = options
        this.forkEvent = {}
        this.startTime = null
        this.EventDefine = ['message', 'error', 'exit']
        this['@status'] = 'stop'
        this.fork = null
    }

    get event() {
        return {
            set: (name, fun) => {
                if (!this.EventDefine.includes(name)) return
                if (typeof fun !== 'function') return
                this.forkEvent[name] = fun
                return true
            },
            delete: (name) => {
                if (!this.EventDefine.includes(name)) return
                delete this.forkEvent[name]
                return true
            }
        }
    }

    async stop(fun) {
        try {
            if (this.fork) await this.fork.kill('SIGTERM')
            this['@status'] = 'stop'
            if (typeof fun === 'function') return await fun(this)
        } catch (error) {
            console.error(`Error stopping process: ${error}`)
        }
    }

    async start(fun) {
        try {
            if (this.fork) await this.stop()
            this['@status'] = 'started'

            const development = structuredClone(this.options)
            Object.keys(development.env).forEach((key) => {
                development.env[key] = JSON.stringify(development.env[key])
            })

            this.fork = fork(this.filePath, { ...(development || {}) })
            this.startTime = Date.now()
            this.ev()

            if (typeof fun === 'function') {
                return await fun(this)
            }
        } catch (e) {
            this['@status'] = 'stop'
            console.error(e)
        }
    }

    ev() {
        if (!this.fork) return
        this.fork.on('message', async (m) => {
            const data = m?.content || m
            if (data?.requestId && this.#requestId.has(data.requestId)) {
                const request = this.#requestId.get(data.requestId)
                clearTimeout(request.timeout)
                this.#requestId.delete(data.requestId)
                return request.resolve(data)
            }

            try {
                if (typeof this.forkEvent?.message === 'function') {
                    return await this.forkEvent.message(m, this)
                }
            } catch (e) { console.error('Error handling message:', e) }
        })

        this.fork.on('error', async (m) => {
            try {
                if (typeof this.forkEvent?.error === 'function') {
                    return await this.forkEvent.error(m, this)
                }
            } catch (e) { console.error('Error handling error event:', e) }
        })

        this.fork.on('exit', async (code, signal) => {
            try {
                if (typeof this.forkEvent?.exit === 'function') {
                    return await this.forkEvent.exit({ code, signal }, this)
                }
            } catch (e) { console.error('Error handling exit event:', e) }
        })
    }

    async send(content, type = 'send') {
        if (!this.fork) return console.error('Fork not started')

        if (type !== 'request') {
            return this.fork.send(content)
        }

        return new Promise((resolve, reject) => {
            const reqId = content.requestId || randomId()
            const timeout = setTimeout(() => {
                this.#requestId.delete(reqId)
                reject(new Error('Request Timeout'))
            }, 10000)

            this.#requestId.set(reqId, { reject, resolve, timeout })

            try {
                this.fork.send({ ...content, requestId: reqId })
            } catch (e) {
                clearTimeout(timeout)
                this.#requestId.delete(reqId)
                reject(e)
            }
        })
    }

    get status() {
        return { process: this.fork }
    }

    get uptime() {
        if (!this.startTime) return null
        return Date.now() - this.startTime
    }
}