// ./plugins/tools/whois.plugin.js
export default {
    command: true, usePrefix: true,
    case: ['whois', 'stalk'],
    description: 'Muestra la información técnica, roles, estadísticas de grupo y foto de perfil de un usuario.',
    category: 'herramientas',
    usage: ['whois @user', 'whois (citado)'],
    script: async (m, { sock }) => {
        let targetId = m.sender.mentioned[0] || m.quoted?.sender?.id || m.sender.id

        await m.react('wait')

        const users = await global.db.open('@users')
        const dbUser = users[targetId] || {}
        
        const name = dbUser.name || m.quoted?.sender?.name || (targetId === m.sender.id ? m.sender.name : 'Desconocido')
        const desc = await sock.fetchStatus(targetId).then(r => r?.status || 'Sin descripción').catch(() => 'Sin descripción')

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
            `╵ Número: ${targetId.split('@')[0]}`,
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
                    text += `\n\n▢ Estadísticas en Grupo\n`
                    text += `- Mensajes: ${groupUser.messages || 0}\n`
                }
            } catch (e) {}
        }

        try {
            const pp = await sock.profilePictureUrl(targetId, 'image').catch(() => 'https://files.catbox.moe/obz4b4.jpg')

            await sock.sendMessage(m.chat.id, { 
                image: { url: pp }, 
                caption: text, 
                contextInfo: { mentionedJid: [targetId] }
            }, { quoted: m.raw })
            
            await m.react('done')
        } catch (err) {
            await m.react('error')
            await m.reply('ⓘ Ocurrió un error al procesar la información del usuario.')
        }
    }
}