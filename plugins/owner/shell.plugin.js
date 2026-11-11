// ./plugins/owner/shell.plugin.js
import { exec } from 'child_process'
import util from 'util'

const execPromise = util.promisify(exec)

const MAX_OUTPUT       = 4000
const SHELL_TIMEOUT    = 60_000
const SHELL_MAX_BUFFER = 10 * 1024 * 1024

const truncate = (str) => {
    if (typeof str !== 'string') str = String(str)
    if (str.length <= MAX_OUTPUT) return str
    return str.slice(0, MAX_OUTPUT) + `\n… (truncado: ${str.length - MAX_OUTPUT} chars)`
}

const extractFromQuoted = async (m) => {
    if (!m.quoted) return ''
    if (m.quoted.content?.isMedia) {
        const mediaBuffer = await m.getQuotedMedia()
        if (mediaBuffer?.length) return mediaBuffer.toString('utf-8')
    }
    return m.getQuotedText() || ''
}

export default {
    command: true, usePrefix: true,
    before: true,
    case: ['>', '=>', '$'],
    description: 'Ejecuta código JavaScript asíncrono o comandos Shell (soporta citar archivos o mensajes con código/dumps).',
    category: 'owner',
    usage: [
        '> ‹script›', '=> ‹return script›',
        '$ ‹shell›', '> (citando archivo/mensaje con código)'
    ],
    script: async (m, { sock, modules, control }) => {
        if (!m.sender.role('root', 'owner')) return

        const body = (m.body ?? m.content?.text ?? '').trim()
        if (!body) return

        try {
            if (body.startsWith('=>') || body.startsWith('>')) {
                await m.react('wait')

                const isAutoReturn = body.startsWith('=>')
                let codeRaw = body.slice(isAutoReturn ? 2 : 1).trim()

                if (!codeRaw) codeRaw = await extractFromQuoted(m)

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
                    await m.reply(truncate(result))
                }

                await m.react('done')
                if (control) control.end = true
            }
            else if (body.startsWith('$')) {
                await m.react('wait')

                let shellCommand = body.slice(1).trim()
                if (!shellCommand) shellCommand = await extractFromQuoted(m)

                if (!shellCommand) {
                    await m.react('error')
                    return m.reply('ⓘ No se proporcionó ningún comando shell.')
                }

                const { stdout, stderr } = await execPromise(shellCommand, {
                    timeout: SHELL_TIMEOUT,
                    maxBuffer: SHELL_MAX_BUFFER,
                    windowsHide: true
                })

                const response = (stdout || stderr || 'No output').trim()
                await m.reply(truncate(response) || 'No output')
                await m.react('done')
                if (control) control.end = true
            }
        } catch (err) {
            await m.react('error')
            await m.reply(`ⓘ *Excepción atrapada:*\n\n${truncate(String(err))}`)
        }
    }
}