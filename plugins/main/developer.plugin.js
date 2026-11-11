// ./plugins/main/developer.plugin.js
export default {
    command: true, usePrefix: true,
    case: ['creador', 'developer', 'creator'],
    description: 'Muestra la tarjeta de contacto oficial e interactiva del desarrollador mediante AIRich.',
    category: 'main',
    usage: ['creador'],
    script: async (m, { sock }) => {
        await m.react('wait')

        try {
            const bannerUrl = 'https://files.catbox.moe/0pevpc.png'
            const logoUrl = 'https://files.catbox.moe/my89of.png'

            const rich = new sock.AIRich()
                .addBanner(bannerUrl)
                .addCompactEntity([
                    {
                        title: 'Orwyth',
                        subtitle: 'Full Stack Developer',
                        secondarySubtitle: 'orwyth.site',
                        image: logoUrl,
                        id: 447451211890,
                        url: 'https://wa.me/447451211890?text=Hola%20Orwyth',
                        type: 'PERSON',
                        action: 'MESSAGE',
                        verified: true
                    }
                ])
                .addText(
                    '*Orwyth - Lead Developer*\n' +
                    '- Rol: Creador y Arquitecto Principal de Aethero Framework\n' +
                    '- Contacto directo: [Conversar por WhatsApp](https://wa.me/447451211890)\n' +
                    '- Repositorio oficial: [Syllkom / Aethero](https://github.com/Syllkom/Aethero)'
                )
                .addSuggest(['root', 'developer', 'info', 'owner'])
                .setFooter('Aethero Framework - Developed by Orwyth')

            await rich.send(m.chat.id)
            await m.react('done')
        } catch (e) {
            await m.react('error')
            return m.reply('Error al enviar tarjeta de desarrollador: ' + e.message)
        }
    }
}