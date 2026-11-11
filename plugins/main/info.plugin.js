// ./plugins/main/info.plugin.js
import os from 'os'
import fs from 'fs'
import path from 'path'
import { performance } from 'perf_hooks'
import moment from 'moment-timezone'
import { countTotalCommands, inspectPlugins } from '../../library/pluginInspector.js'

let botVersion = '1.0.0'
try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve('./package.json'), 'utf-8'))
    botVersion = pkg.version || botVersion
} catch {}

const formatSize = (bytes) => {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB'
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB'
    return (bytes / 1024).toFixed(2) + ' KB'
}

const formatUptime = (s) => {
    const d = Math.floor(s / 86400)
    const h = Math.floor((s % 86400) / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sc = Math.floor(s % 60)
    return `${d}d ${h}h ${m}m ${sc}s`
}

const formatDate = (n) => moment(n).format('DD/MM/YYYY HH:mm')

export default {
    command: true, usePrefix: true,
    case: ['info', 'infobot', 'status', 'infogroup', 'infogc'],
    description: 'Muestra información detallada del bot o del grupo usando .info grupo.',
    list: [
        { cmd: 'info', category: 'main' },
        { cmd: 'info grupo', category: 'grupo' }
    ],
    script: async (m, { sock }) => {
        await m.react('wait')

        const sub = (m.args[0] || '').toLowerCase()
        const isGroupReq = ['infogroup', 'infogc'].includes(m.command) ||
                           ['grupo', 'group', 'gc'].includes(sub)

        if (isGroupReq) {
            if (!m.chat.isGroup) return m.reply('ⓘ Este comando solo funciona en grupos.')

            const meta = await m.chat.metaData() || await sock.groupMetadata(m.chat.id).catch(() => null)
            if (!meta) return m.reply('ⓘ No se pudieron obtener los metadatos del grupo.')

            const chatDB = await m.chat.db()
            const settings = chatDB.settings || {}

            const admins = meta.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin')
            const superAdmin = meta.participants.find(p => p.admin === 'superadmin')
            const ownerId = superAdmin?.id || meta.subjectOwner || meta.owner
            const ownerTxt = ownerId ? `@${ownerId.split('@')[0].split(':')[0]}` : 'No disponible'

            let topTalkers = ''
            const activeUsers = []
            if (chatDB.users) {
                const top = Object.entries(chatDB.users)
                    .filter(([, d]) => d.messages > 0)
                    .sort(([, a], [, b]) => (b.messages || 0) - (a.messages || 0))
                    .slice(0, 5)

                if (top.length > 0) {
                    top.forEach(([id]) => activeUsers.push(id))
                    topTalkers = [
                        '╭○ *Top Activos*',
                        ...top.map(([id, d], i) => `╵ ${i + 1}. @${id.split('@')[0]}: \`${d.messages}\` msgs`),
                        '╰╶╴──────╶╴─╶╴◯'
                    ].join('\n')
                }
            }

            const pp = await sock.profilePictureUrl(m.chat.id, 'image').catch(() => 'https://files.catbox.moe/obz4b4.jpg')
            const adminList = admins.map(a => `╵ @${a.id.split('@')[0].split(':')[0]}`).join('\n')
            const state = (k) => settings[k] ? '*ON*' : '*OFF*'
            const isAnnounce = meta.announce ? 'Cerrado' : 'Abierto'

            const groupBoxes = [
                [
                    '╭○ *Info / Grupo*',
                    `╵ Nombre: ${meta.subject}`,
                    `╵ ID: ${meta.id}`,
                    `╵ Creado: ${formatDate(meta.creation * 1000)}`,
                    `╵ Creador: ${ownerTxt}`,
                    '╰╶╴──────╶╴─╶╴◯'
                ].join('\n'),

                [
                    '╭○ *Estadísticas*',
                    `╵ Miembros: ${meta.participants.length}`,
                    `╵ Admins: ${admins.length}`,
                    `╵ Estado: ${isAnnounce}`,
                    '╰╶╴──────╶╴─╶╴◯'
                ].join('\n'),

                topTalkers,

                [
                    '╭○ *Configuración*',
                    `╵ ${state('welcome')} Bienvenida`,
                    `╵ ${state('bye')} Despedida`,
                    `╵ ${state('antilink')} Antilink`,
                    `╵ ${state('detect')} Detect`,
                    `╵ ${state('sololatam')} SoloLatam`,
                    '╰╶╴──────╶╴─╶╴◯'
                ].join('\n'),

                [
                    '╭○ *Administración*',
                    adminList,
                    '╰╶╴──────╶╴─╶╴◯'
                ].join('\n'),

                meta.desc ? `▢ *Descripción*\n${meta.desc.toString().trim()}` : ''
            ]

            const txt = groupBoxes.filter(Boolean).join('\n\n')

            const mentions = [...new Set([
                ...admins.map(a => a.id),
                ownerId,
                ...activeUsers
            ])].filter(Boolean)

            await sock.sendMessage(m.chat.id, {
                image: { url: pp },
                caption: txt,
                mentions
            }, { quoted: m.raw })

            return await m.react('done')
        }

        const t0 = performance.now()

        const totalMem = os.totalmem()
        const freeMem = os.freemem()
        const usedMem = totalMem - freeMem
        const processRam = process.memoryUsage().rss
        const cpuModel = os.cpus()[0]?.model?.trim() || 'Desconocido'
        const cpuCores = os.cpus().length
        const platform = os.platform()
        const uptime = formatUptime(process.uptime())

        const pluginsDir = path.join(process.cwd(), 'plugins')
        const inspection = await inspectPlugins(pluginsDir, { includeNonPrefixed: true })
        const totalCmds = countTotalCommands(inspection.items)
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

        const botBoxes = [
            [
                `╭✦ *${global.config.name} / Info*`,
                `╵ Nombre: ${global.config.name}`,
                `╵ Versión: v${botVersion}`,
                `╵ Base de Datos: HyperDB + SQLite`,
                `╵ Creador: Orwyth`,
                `╵ Prefijos: [ ${global.config.prefixes} ]`,
                '╰╶╴──────╶╴─╶╴◯'
            ].join('\n'),

            [
                '╭○ *Estadísticas*',
                `╵ Usuarios: ${totalUsers}`,
                `╵ Grupos: ${totalGroups}`,
                `╵ Plugins: ${totalFiles} archivos`,
                `╵ Comandos: ${totalCmds} funciones`,
                `╵ Latencia: ${latency} ms`,
                `╵ Activo: ${uptime}`,
                '╰╶╴──────╶╴─╶╴◯'
            ].join('\n'),

            [
                '╭○ *Servidor*',
                `╵ RAM Bot: ${formatSize(processRam)}`,
                `╵ RAM Total: ${formatSize(usedMem)} / ${formatSize(totalMem)}`,
                `╵ Sistema: ${platform} (${os.release()})`,
                `╵ Procesador: ${cpuModel} (${cpuCores} cores)`,
                '╰╶╴──────╶╴─╶╴◯'
            ].join('\n'),

            `_Node.js ${process.version}_`
        ]

        const txt = botBoxes.filter(Boolean).join('\n\n')

        await sock.sendMessage(m.chat.id, {
            image: { url: pp },
            caption: txt
        }, { quoted: m.raw })

        await m.react('done')
    }
}