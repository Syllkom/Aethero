// ./plugins/owner/shell.plugin.js
import { exec } from 'child_process'
import util from 'util'

const execPromise = util.promisify(exec)

export default {
    command: true, usePrefix: false,
    case: ['>', '=>', '$'],
    description: 'Ejecuta código JavaScript asíncrono o comandos Shell (soporta citar archivos o mensajes con código/dumps).',
    category: 'owner',
    usage: [
        '> ‹script›',
        '=> ‹return script›',
        '$ ‹shell›',
        '> (citando un archivo .js/documento o mensaje de texto con código)'
    ],
    script: async (m, { sock, modules }) => {
        if (!m.sender.role('root', 'owner')) return m.sms('owner')

        try {
            if (m.body.startsWith('=>') || m.body.startsWith('>')) {
                await m.react('wait')

                const isAutoReturn = m.body.startsWith('=>')
                let codeRaw = m.body.slice(isAutoReturn ? 2 : 1).trim()

                if (!codeRaw && m.quoted) {
                    if (m.quoted.content?.isMedia) {
                        const mediaBuffer = await m.getQuotedMedia()
                        if (mediaBuffer && mediaBuffer.length) {
                            codeRaw = mediaBuffer.toString('utf-8')
                        }
                    } else {
                        codeRaw = m.getQuotedText()
                    }
                }

                if (!codeRaw) {
                    await m.react('error')
                    return m.reply('ⓘ No se proporcionó ningún código ni archivo citado para ejecutar.')
                }

                const code = isAutoReturn ? `return (${codeRaw})` : codeRaw

                const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor
                const print = (...args) => m.reply(util.format(...args))

                const execCode = new AsyncFunction(
                    'm', 'sock', 'modules', 'global', 'print', 'db',
                    code
                )

                let result = await execCode(m, sock, modules, global, print, global.db)

                if (typeof result !== 'undefined') {
                    if (typeof result !== 'string') result = util.inspect(result, { depth: 2 })
                    await m.reply(result)
                }

                await m.react('done')
            }
            else if (m.body.startsWith('$')) {
                await m.react('wait')
                let shellCommand = m.body.slice(1).trim()

                if (!shellCommand && m.quoted) {
                    if (m.quoted.content?.isMedia) {
                        const mediaBuffer = await m.getQuotedMedia()
                        if (mediaBuffer && mediaBuffer.length) {
                            shellCommand = mediaBuffer.toString('utf-8')
                        }
                    } else {
                        shellCommand = m.getQuotedText()
                    }
                }

                if (!shellCommand) {
                    await m.react('error')
                    return m.reply('ⓘ No se proporcionó ningún comando shell.')
                }

                const { stdout, stderr } = await execPromise(shellCommand)
                const response = stdout || stderr || 'No output'
                await m.reply(response.trim())
                await m.react('done')
            }
        } catch (err) {
            await m.react('error')
            await m.reply(`ⓘ *Excepción atrapada:*\n\n${String(err)}`)
        }
    }
}