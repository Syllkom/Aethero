// ./plugins/tools/setpp.plugin.js
export default {
    command: true, usePrefix: true,
    case: ['setpp', 'setpf', 'setfoto'],
    description: 'Actualiza la foto de perfil del bot o de un grupo utilizando una imagen enviada o citada.',
    category: 'herramientas',
    list: [
        { cmd: 'setpp bot (imagen)', category: 'owner' },
        { cmd: 'setpp grupo (imagen)', category: 'adm' }
    ],
    script: async (m, { sock }) => {
        const target = (m.type === 'imageMessage' && m.content?.media) ? m
                     : (m.quoted?.type === 'imageMessage' && m.quoted?.content?.media) ? m.quoted
                     : null

        if (!target) return m.reply('ⓘ Enviá o respondé a una imagen.')

        const arg = m.args[0]?.toLowerCase()

        const isBotTarget   = arg === 'bot' || arg === 'b' || (!arg && !m.chat.isGroup)
        const isGroupTarget = arg === 'grupo' || arg === 'g' || arg === 'group' || (!arg && m.chat.isGroup)

        if (isBotTarget) {
            if (!m.sender.role('root', 'owner')) return m.reply('ⓘ Solo el owner puede cambiar la foto del bot.')
            await m.react('wait')
            try {
                const buffer = await target.content.media.download()
                const resized = await sock.resizePhoto({ image: buffer, scale: 720, result: 'buffer', fit: 'contain' })
                await m.bot.setPhoto(resized)
                await m.react('done')
            } catch (e) {
                console.error('[setpp bot]', e.message)
                await m.react('error')
                await m.reply(`ⓘ No se pudo cambiar la foto del bot.\n_${e.message}_`)
            }

        } else if (isGroupTarget) {
            if (!m.chat.isGroup) return m.reply('ⓘ Este subcomando solo funciona en grupos.')
            if (!m.sender.role('admin', 'owner', 'root')) return m.reply('ⓘ Necesitás ser administrador del grupo.')
            await m.react('wait')
            try {
                const buffer = await target.content.media.download()
                const resized = await sock.resizePhoto({ image: buffer, scale: 720, result: 'buffer', fit: 'contain' })
                await m.chat.setPhoto(resized)
                await m.react('done')
            } catch (e) {
                console.error('[setpp group]', e.message)
                await m.react('error')
                await m.reply(`ⓘ No se pudo cambiar la foto del grupo.\n_${e.message}_`)
            }

        } else {
            return m.reply(
                `ⓘ *Uso:*\n` +
                `- _.setpp bot_ (imagen) — Foto del bot\n` +
                `- _.setpp grupo_ (imagen) — Foto del grupo`
            )
        }
    }
}