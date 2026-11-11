// ./plugins/main/script.plugin.js
import got from 'got'

export default {
    command: true, usePrefix: true,
    category: 'main', case: ['script', 'sc', 'aethero'],
    description: 'Informacion oficial y arquitectura del framework Aethero.',
    usage: ['script'],
    script: async (m, { sock }) => {
        await m.react('wait')

        const owner = 'Syllkom'
        const repo = 'Aethero'

        let stars = 0
        let forks = 0
        let issues = 0
        let lastPush = 'N/A'

        try {
            const repoData = await got(`https://api.github.com/repos/${owner}/${repo}`, {
                headers: {
                    'User-Agent': 'Aethero-Framework-Bot',
                    'Accept': 'application/vnd.github.v3+json'
                },
                responseType: 'json',
                timeout: { request: 10000 }
            }).json()

            stars = repoData.stargazers_count ?? 0
            forks = repoData.forks_count ?? 0
            issues = repoData.open_issues_count ?? 0

            if (repoData.pushed_at) {
                lastPush = new Date(repoData.pushed_at).toLocaleDateString('es-ES', {
                    day: '2-digit', month: '2-digit', year: 'numeric'
                })
            }
        } catch {}

        const caption = [
            `✦ *Aethero Framework* ✦`,
            '',
            `- *Creador:* Syllkom (Orwyth)`,
            `- *Sitio Web:* orwyth(.)site`,
            `- *Licencia:* MIT (Codigo Abierto)`,
            `- *Entorno:* Node.js >= 22.5.0 (ESM)`,
            '',
            '╭Ⰶ Estadisticas Github',
            `╵ - Estrellas (Stars): ${stars.toLocaleString()}`,
            `╵ - Bifurcaciones (Forks): ${forks.toLocaleString()}`,
            `╵ - Issues activas: ${issues.toLocaleString()}`,
            `╵ - Ultima actualizacion: ${lastPush}`,
            '╰╶╴──────╶╴─╶╴◯',
            '',
            `_Concebido y programado por Orwyth & Zeppth_`
        ].join('\n')

        const repoUrl = `https://github.com/${owner}/${repo}`
        const ogBannerUrl = `https://opengraph.githubassets.com/1/${owner}/${repo}`
        const faviconUrl = 'https://files.catbox.moe/my89of.png'

        await sock.sendMessage(m.chat.id, {
            richLink: {
                url: repoUrl,
                title: 'Aethero Framework — WhatsApp Engine',
                description: 'Framework Event-Driven modular con aislamiento de procesos y Hot-Reload.',
                text: caption,
                banner: ogBannerUrl,
                favicon: faviconUrl,
                hideUrl: true
            }
        }, { quoted: m.raw })

        await m.react('done')
    }
}