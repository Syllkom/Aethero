// ./plugins/main/invite.plugin.js
export default {
    command: true, usePrefix: true,
    case: ['invite', 'join'],
    description: 'Permite solicitar el ingreso del bot a grupos mediante enlaces de invitación, enviando la petición al propietario para su aprobación o rechazo manual.',
    category: 'main',
    usage: 'join ‹url›',
    script: async (m, { sock }) => {
        let inviteCode = null
        const linkRegex = /chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/i
        const match = m.text.match(linkRegex)

        if (match) {
            inviteCode = match[1]
        } else if (m.chat.isGroup) {
            if (!m.bot.roles.admin) return m.reply('No soy admin para generar el link. Pásame un enlace válido.')
            inviteCode = await sock.groupInviteCode(m.chat.id)
        } else {
            return m.reply('Por favor, escribe el comando seguido del enlace del grupo.')
        }

        await m.react('wait')

        try {
            const meta = await sock.groupGetInviteInfo(inviteCode)
            const ownerKey = Object.keys(global.config.userRoles).find(id => global.config.userRoles[id].root)

            if (!ownerKey) return m.reply('No hay un Owner configurado para recibir la solicitud.')

            const ownerId = ownerKey.includes('@') ? ownerKey : ownerKey + '@s.whatsapp.net'

            const txt = [
                '╭ⓘ *Solicitud De Ingreso*',
                `╵ Solicitante: _@${m.sender.number}_`,
                `╵ Grupo: _${meta.subject}_`,
                `╵ ID: _${meta.id}_`,
                `╵ Creación: _${new Date(meta.creation * 1000).toLocaleDateString()}_`,
                '╰╶╴──────╶╴─╶╴◯', // Coma agregada aquí
                '',
                `_*Link:* https://chat.whatsapp.com/${inviteCode}_`,
                '_Responde a este mensaje con "si", "ok" o "aceptar" para autorizar el ingreso._'
            ].join('\n')

            const msg = await sock.sendMessage(ownerId, {
                text: txt,
                contextInfo: {
                    mentionedJid: [m.sender.id],
                    externalAdReply: {
                        title: 'Nueva Solicitud de Grupo',
                        body: meta.subject,
                        thumbnailUrl: await sock.profilePictureUrl(meta.id, 'image').catch(() => null),
                        mediaType: 1
                    }
                }
            })

            await sock.setReplyHandler(msg, {
                security: { userId: ownerId, chatId: ownerId, scope: 'private' },
                lifecycle: { consumeOnce: true },
                state: { code: inviteCode, requester: m.sender.id },
                routes: [{
                    code: {
                        executor: async (m, ctx) => {
                            const response = m.body.toLowerCase().trim()

                            if (['si', 'ok', 'aceptar', 'join', 'yes'].includes(response)) {
                                try {
                                    await m.bot.join(ctx.state.code)

                                    await m.reply('✓ Solicitud aceptada. Uniéndome al grupo...')
                                    await ctx.sock.sendMessage(ctx.state.requester, { text: '✓ Tu solicitud fue aceptada por el Owner.' })
                                } catch (e) {
                                    await m.reply(`✗ Error al unirse: ${e.message}`)
                                }
                            } else {
                                await m.reply('ⓘ Solicitud rechazada o cancelada.')
                                await ctx.sock.sendMessage(ctx.state.requester, { text: '✗ Tu solicitud fue rechazada.' })
                            }
                        }
                    }
                }]
            })

            await m.reply('ⓘ Solicitud enviada al Owner. Espera su aprobación.')
            await m.react('done')

        } catch (e) {
            console.error(e)
            await m.react('error')
            m.reply('El enlace no es válido o ha expirado.')
        }
    }
}