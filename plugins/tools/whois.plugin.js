// ./plugins/tools/whois.plugin.js

export default {
    command: true, usePrefix: true,
    case: ['whois', 'stalk'],
    category: 'tools', description: 'Muestra la informacion tecnica, roles, estadisticas y foto de perfil de un usuario.',
    usage: ['whois @user', 'whois (citado)'],
    script: async (m, { sock }) => {
        let targetId = m.sender.mentioned[0] || m.quoted?.sender?.id || m.sender.id

        await m.react('wait')

        const users = await global.db.open('@users')
        const dbUser = users[targetId] || {}
        
        const name = dbUser.name || m.quoted?.sender?.name || (targetId === m.sender.id ? m.sender.name : 'Desconocido')
        
        let desc = 'Sin descripcion'
        try {
            if (typeof sock?.fetchStatus === 'function') {
                const statusRes = await sock.fetchStatus(targetId)
                if (statusRes?.status) desc = statusRes.status
            }
        } catch {}

        const configRoles = global.config.userRoles?.[targetId] || global.config.userRoles?.[targetId.split('@')[0]] || {}
        const dbRoles = dbUser.roles || {}
        const roles = { ...dbRoles, ...configRoles }

        const rootStatus = roles.root ? '✓' : '✗'
        const ownerStatus = roles.owner ? '✓' : '✗'
        const modStatus = roles.mod ? '✓' : '✗'
        const vipStatus = roles.vip ? '✓' : '✗'
        const banStatus = dbUser.banned ? '✓' : '✗'

        let text = [
            '```╭○ Perfil / User',
            `╵ Nombre: ${name}`,
            `╵ Numero: ${targetId.split('@')[0]}`,
            `╵ JID: ${targetId}`,
            `╵ Estado: ${desc}`,
            '╰╶╴──────╶╴─╶╴◯',
            '',
            '╭○ Roles y Seguridad',
            `╵ Root:        ${rootStatus}`,
            `╵ Propietario: ${ownerStatus}`,
            `╵ Moderador:   ${modStatus}`,
            `╵ Premium:     ${vipStatus}`,
            `╵ Baneado:     ${banStatus}`,
            '╰╶╴──────╶╴─╶╴◯```'
        ].join('\n')

        if (m.chat.isGroup) {
            try {
                const chatDb = await m.chat.db()
                const groupUser = chatDb.users?.[targetId]
                if (groupUser) {
                    text += `\n\n▢ Estadisticas en Grupo\n`
                    text += `- Mensajes: ${groupUser.messages || 0}\n`
                }
            } catch (e) {}
        }

        try {
            let pp = 'https://files.catbox.moe/obz4b4.jpg'
            try {
                if (typeof sock?.profilePictureUrl === 'function') {
                    pp = (await sock.profilePictureUrl(targetId, 'image')) || pp
                }
            } catch {}

            await sock.sendMessage(m.chat.id, { 
                image: { url: pp }, 
                caption: text, 
                contextInfo: { mentionedJid: [targetId] }
            }, { quoted: m.raw })
            
            await m.react('done')
        } catch (err) {
            console.error('[Whois Error]:', err)
            await m.react('error')
            await m.reply('[!] Ocurrio un error al procesar la informacion del usuario.')
        }
    }
}