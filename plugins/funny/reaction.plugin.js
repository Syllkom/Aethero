// ./plugins/funny/reaction.plugin.js
import got from 'got'
import { gifToMp4 } from '../../library/media/giftConverter.js'

const ACTIONS = {
    'kiss':   { type: 'sfw', endpoint: 'kiss',   emoji: '💋', msg: '@{me} besó apasionadamente a @{target}' },
    'hug':    { type: 'sfw', endpoint: 'hug',    emoji: '🤗', msg: '@{me} le dio un cálido abrazo a @{target}' },
    'pat':    { type: 'sfw', endpoint: 'pat',    emoji: '💆‍♂️', msg: '@{me} acarició con cariño a @{target}' },
    'slap':   { type: 'sfw', endpoint: 'slap',   emoji: '👋', msg: '@{me} le dio una cachetada a @{target}' },
    'kill':   { type: 'sfw', endpoint: 'kill',   emoji: '🔪', msg: '@{me} asesinó a sangre fría a @{target}' },
    'dance':  { type: 'sfw', endpoint: 'dance',  emoji: '💃', msg: '@{me} está bailando con @{target}' },
    'bite':   { type: 'sfw', endpoint: 'bite',   emoji: '🦷', msg: '@{me} mordió a @{target}' },
    'punch':  { type: 'sfw', endpoint: 'punch',  emoji: '🥊', msg: '@{me} le metió un puñetazo a @{target}' },
    'cuddle': { type: 'sfw', endpoint: 'cuddle', emoji: '🫂', msg: '@{me} se acurrucó con @{target}' },
    'follar': { type: 'nsfw', endpoint: 'waifu', emoji: '👉👌', msg: '@{me} se folló durísimo a @{target}' },
    'bj':     { type: 'nsfw', endpoint: 'blowjob', emoji: '🍆', msg: '@{target} se la chupó a @{me}' }
}

async function fetchReactionGif(endpoint, isNsfw = false) {
    if (isNsfw) {
        const nsfwMap = { 'waifu': 'fuck', 'follar': 'fuck', 'bj': 'blowjob', 'blowjob': 'blowjob' }
        const ep = nsfwMap[endpoint] || 'fuck'
        const res = await got(`https://purrbot.site/api/img/nsfw/${ep}/gif`, {
            responseType: 'json',
            timeout: { request: 10000 }
        }).json()
        return res.link
    } else {
        const sfwMap = { 'kill': 'shoot' }
        const ep = sfwMap[endpoint] || endpoint
        const res = await got(`https://nekos.best/api/v2/${ep}`, {
            responseType: 'json',
            timeout: { request: 10000 }
        }).json()
        return res.results?.[0]?.url
    }
}

export default {
    command: true,
    usePrefix: true,
    case: Object.keys(ACTIONS),
    description: 'Comandos de interacción y reacciones anime en video/GIF en bucle.',
    category: 'funny',
    list: Object.keys(ACTIONS).map(k => ({
        cmd: `${k} @user`,
        category: ACTIONS[k].type === 'nsfw' ? 'nsfw' : 'funny'
    })),
    script: async (m, { sock }) => {
        const action = ACTIONS[m.command]
        if (!action) return

        let target = m.sender.mentioned[0] || m.quoted?.sender?.id

        if (!target) {
            return m.reply(`ⓘ Menciona o responde al mensaje de la persona.\n- Ejemplo: .${m.command} @usuario`)
        }
        if (target === m.sender.id) {
            return m.reply('¿Te quieres hacer eso a ti mismo? Raro...')
        }

        await m.react(action.emoji)

        try {
            const isNsfw = action.type === 'nsfw'
            const gifUrl = await fetchReactionGif(action.endpoint, isNsfw)

            if (!gifUrl) {
                await m.react('error')
                return m.reply('ⓘ No se pudo obtener la animación en este momento.')
            }

            const gifBuffer = await got(gifUrl, { timeout: { request: 15000 } }).buffer()
            const mp4Buffer = await gifToMp4(gifBuffer)

            const meNum = m.sender.number || m.sender.id.split('@')[0]
            const targetNum = target.split('@')[0]

            const caption = action.msg
                .replace('{me}', meNum)
                .replace('{target}', targetNum)

            await sock.sendMessage(m.chat.id, {
                video: mp4Buffer,
                caption: caption,
                gifPlayback: true,
                mentions: [m.sender.id, target]
            }, { quoted: m.raw })

            await m.react('done')

        } catch (e) {
            console.error('Reaction Plugin Error:', e.message)
            await m.react('error')
            m.reply(`ⓘ Error al procesar la reacción: ${e.message}`)
        }
    }
}