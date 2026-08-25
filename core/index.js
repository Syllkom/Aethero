// ./core/index.js
import path from 'path'
import chalk from 'chalk'
import { ForkManager } from './library/makeFork.js'
import { runBootPrompt } from './library/bootPrompt.js'

async function EventMessage(m) {
    switch (m.type) {
        case 'open':
            console.log(chalk.rgb(70, 209, 70)('Connection open:'), { ...m.data })
            break
        case 'close':
            console.log(chalk.rgb(201, 54, 54)('Connection close:'), { ...m.data })
            break
        case 'pairing': {
            if (m.event === 'qr-code') {
                console.log(chalk.rgb(16, 61, 207)('qr code:'))
                console.log(m.data.qrCodeText)
            } else if (m.event === 'pin-code') {
                console.log(chalk.rgb(16, 61, 207)('pin code:'))
                console.log(m.data.formattedCode)
            }
            break
        }
    }
}

export class CoreI {
    constructor(modulePath, env, options) {
        this.modulePath = modulePath ?? path.resolve('./core/main.js')
        this.options = options
        this.fork = null
        this.env = env
    }

    async stop() {
        if (this.fork) await this.fork.stop()
        return true
    }

    async start() {
        let env = this.env ?? {}

        if (!env.connOptions?.connectType) {
            const promptResult = await runBootPrompt(env.STORAGE || './storage')
            if (promptResult) Object.assign(env, { connOptions: promptResult })
        }

        this.fork = new ForkManager(this.modulePath, {
            execArgv: ['--max-old-space-size=512'],
            cwd: path.resolve(process.cwd()),
            serialization: 'json',
            ...(this.options || {}),
            env: {
                HOME: process.env.HOME || process.cwd(),
                ...env
            }
        })

        await this.Event()
        await this.fork.start()
    }

    Event() {
        this.fork.event.set('message', async (m) => {
            await EventMessage(m)
        })

        this.fork.event.set('exit', async ({ code, signal }) => {
            console.log({ code, signal })
            await new Promise(resolve => setTimeout(resolve, 2000))
            await this.fork.start()
        })

        this.fork.event.set('error', (e) => {
            console.error('Error:', e)
        })
    }
}