// ./plugins/events/stubtype.detect.plugin.js
export default {
    stubtype: true,
    case: [
        'GROUP_PARTICIPANT_PROMOTE', 
        'GROUP_PARTICIPANT_DEMOTE', 
        'GROUP_CHANGE_SUBJECT', 
        'GROUP_CHANGE_ICON', 
        'GROUP_CHANGE_ANNOUNCE', 
        'GROUP_CHANGE_RESTRICT',
        'GROUP_CHANGE_DESCRIPTION'
    ],
    script: async (m, { sock, parameters, even }) => {
        const db = await global.db.open(`@chat:${m.chat.id}`)
        const settings = db.settings || {}

        if (!settings.detect) return

        const chatId = m.chat.id
        const actor = m.sender.id || m.sender.user
        const actorName = actor.split('@')[0]

        let text = ''
        let image = null
        let mentions = [actor]

        if (['GROUP_PARTICIPANT_PROMOTE', 'GROUP_PARTICIPANT_DEMOTE'].includes(even)) {
            const data = parameters[0]
            const target = data?.phoneNumber || data
            if (!target || typeof target !== 'string') return

            const targetName = target.split('@')[0]
            mentions.push(target)

            if (even === 'GROUP_PARTICIPANT_PROMOTE') text = `➚ Nuevo Admin\n\n@${targetName} promovido por @${actorName}.`
            else text = `➘ Admin Degradado\n\n@${targetName} degradado por @${actorName}.`
        }

        else if (even === 'GROUP_CHANGE_SUBJECT') text = `✎ Nombre del Grupo Cambiado\n\nNuevo: ${parameters[0]}\nPor: @${actorName}`
        else if (even === 'GROUP_CHANGE_DESCRIPTION') text = `ⓘ Descripción Actualizada\n\nLa info del grupo fue modificada por @${actorName}`
        else if (even === 'GROUP_CHANGE_ANNOUNCE') text = `ⓘ Chat ${parameters[0] === 'on' ? 'CERRADO' : 'ABIERTO'}\nPor: @${actorName}`
        else if (even === 'GROUP_CHANGE_RESTRICT') text = `ⓘ Info del Grupo ${parameters[0] === 'on' ? 'Restringida' : 'Abierta'}\nPor: @${actorName}`
        else if (even === 'GROUP_CHANGE_ICON') {
            text = `↺ Foto del Grupo Actualizada\nPor: @${actorName}`
            image = await sock.profilePictureUrl(chatId, 'image').catch(() => null)
        }

        if (text) {
            if (image) await sock.sendMessage(chatId, { image: { url: image }, caption: text, mentions: mentions })
            else await sock.sendMessage(chatId, { text: text, mentions: mentions })
        }
    }
}