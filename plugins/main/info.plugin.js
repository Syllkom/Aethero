import os from 'os'
import path from 'path'
import { performance } from 'perf_hooks'
import moment from 'moment-timezone'
import { inspectPlugins, countTotalCommands, listCategoryUsage } from '../../library/pluginInspector.js'

const formatSize = (bytes) => {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB'
    if (bytes >= 1048576)    return (bytes / 1048576).toFixed(2) + ' MB'
    return (bytes / 1024).toFixed(2) + ' KB'
}

const formatUptime = (s) => {
    const d = Math.floor(s / 86400)
    const h = Math.floor((s % 86400) / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sc = Math.floor(s % 60)
    return `${d}d ${h}h ${m}m ${sc}s`
}

const formatDate = (n) =>
    moment(n).format('DD/MM/YYYY HH:mm')

export default {
    command: true, usePrefix: true,
    case: ['info', 'infobot', 'status', 'infogroup', 'infogc'],
    description: 'Muestra información detallada del bot y grupos, incluyendo estadísticas.',
    list: [
        { cmd: 'info', category: 'main' },
        { cmd: 'infogc', category: 'grupo' }
    ],
    script: async (m, { sock }) => {
        const isGroupReq = ['infogroup', 'infogc'].includes(m.command) ||
                           (m.command === 'info' && m.args[0] === 'group')

        await m.react(isGroupReq ? '📊' : '⚡')

        if (isGroupReq) {
            if (!m.chat.isGroup) return m.reply('ⓘ Este comando solo funciona en grupos.')

            const meta      = await sock.groupMetadata(m.chat.id)
            const chatDB    = await m.chat.db()
            const settings  = chatDB.settings || {}

            const admins     = meta.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin')
            const superAdmin = meta.participants.find(p => p.admin === 'superadmin')
            const ownerId    = superAdmin?.id || meta.subjectOwner || meta.owner
            const ownerTxt   = ownerId ? `@${ownerId.split('@')[0].split(':')[0]}` : 'No disponible'

            // Top activos
            let topTalkersTxt = ''
            const activeUsers = []
            if (chatDB.users) {
                const top = Object.entries(chatDB.users)
                    .filter(([, d]) => d.messages > 0)
                    .sort(([, a], [, b]) => (b.messages || 0) - (a.messages || 0))
                    .slice(0, 5)

                if (top.length > 0) {
                    top.forEach(([id]) => activeUsers.push(id))
                    topTalkersTxt = '\n➚ *Top Activos*\n' +
                        top.map(([id, d], i) => {
                            const medal = ['🥇','🥈','🥉','▫️','▫️'][i]
                            return `${medal} @${id.split('@')[0]}: \`${d.messages}\` msgs`
                        }).join('\n')
                }
            }

            const pp        = await sock.profilePictureUrl(m.chat.id, 'image').catch(() => 'https://files.catbox.moe/obz4b4.jpg')
            const adminList = admins.map(a => `╵ @${a.id.split('@')[0].split(':')[0]}`).join('\n')
            const state     = (k) => settings[k] ? '*ON*' : '*OFF*'
            const isAnnounce = meta.announce ? 'Cerrado' : 'Abierto'

            const txt = [
                '╭○ *Info / Grupo*',
                `╵ Nombre: ${meta.subject}`,
                `╵ ID: \`${meta.id}\``,
                `╵ Creado: ${formatDate(meta.creation * 1000)}`,
                `╵ Creador: ${ownerTxt}`,
                '╰╶╴──────╶╴─╶╴◯',
                '',
                `╭ⓘ *Estadísticas*`,
                `╵ Miembros: ${meta.participants.length}`,
                `╵ Admins: ${admins.length}`,
                `╵ Estado: ${isAnnounce}`,
                '╰╶╴──────╶╴─╶╴◯',
                topTalkersTxt,
                '',
                `╭○ *Configuración*`,
                `╵ ${state('welcome')} Bienvenida`,
                `╵ ${state('bye')} Despedida`,
                `╵ ${state('antilink')} Antilink`,
                `╵ ${state('detect')} Detect`,
                `╵ ${state('sololatam')} SoloLatam`,
                '╰╶╴──────╶╴─╶╴◯',
                '',
                `╭ⓘ *Administración*`,
                adminList,
                '╰╶╴──────╶╴─╶╴◯',
                meta.desc ? `\n▢ *Descripción*\n${meta.desc.toString()}` : ''
            ].join('\n')

            const mentions = [...new Set([
                ...admins.map(a => a.id),
                ownerId,
                ...activeUsers
            ])].filter(Boolean)

            await sock.sendMessage(m.chat.id, {
                image: { url: pp },
                caption: txt,
                mentions
            }, { quoted: m.message })

            return await m.react('done')
        }

        const t0 = performance.now()

        const totalMem  = os.totalmem()
        const freeMem   = os.freemem()
        const usedMem   = totalMem - freeMem
        const processRam = process.memoryUsage().rss
        const cpuModel  = os.cpus()[0].model.trim()
        const cpuCores  = os.cpus().length
        const platform  = os.platform()
        const uptime    = formatUptime(process.uptime())

        const pluginsDir = path.join(process.cwd(), 'plugins')
        const inspection = await inspectPlugins(pluginsDir, { includeNonPrefixed: true })
        const totalCmds  = countTotalCommands(inspection.items)
        const totalFiles = inspection.items.length

        let totalUsers = 0
        try {
            const dbUsers = await global.db.open('@users')
            totalUsers = Object.keys(dbUsers || {}).length
        } catch {}

        let totalGroups = 0
        try {
            const groups = await sock.groupFetchAllParticipating()
            totalGroups = Object.keys(groups || {}).length
        } catch {}

        const latency = (performance.now() - t0).toFixed(2)
        const pp = await m.bot.getPhoto().catch(() => 'https://files.catbox.moe/obz4b4.jpg')

        const txt = [
            `╭✦ *${global.config.name} / Info*`,
            `╵ Nombre: ${global.config.name}`,
            `╵ Versión: ${global.$package.version}`,
            `╵ DataBase: @syllkom/hyper-db`,
            `╵ Creador: Syllkom`,
            `╵ Prefijos: [ ${global.config.prefixes} ]`,
            '╰╶╴──────╶╴─╶╴◯',
            '',
            `╭○ *Estadísticas*`,
            `╵ Usuarios: ${totalUsers}`,
            `╵ Grupos: ${totalGroups}`,
            `╵ Plugins: ${totalFiles} archivos`,
            `╵ Comandos: ${totalCmds} funciones`,
            `╵ Latencia: ${latency} ms`,
            `╵ Activo: ${uptime}`,
            '╰╶╴──────╶╴─╶╴◯',
            '',
            `╭ⓘ *Servidor*`,
            `╵ RAM Bot: ${formatSize(processRam)}`,
            `╵ RAM Total: ${formatSize(usedMem)} / ${formatSize(totalMem)}`,
            `╵ OS: ${platform} (${os.release()})`,
            `╵ CPU: ${cpuModel} (${cpuCores} core)`,
            '╰╶╴──────╶╴─╶╴◯',
            '',
            `_Node.js ${process.version}_`
        ].join('\n')

        await sock.sendMessage(m.chat.id, {
            image: { url: pp },
            caption: txt
        }, { quoted: m.message })

        await m.react('done')
    }
}
