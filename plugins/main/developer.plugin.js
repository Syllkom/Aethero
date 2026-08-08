export default {
    command: true, usePrefix: true,
    case: ['creador', 'developer', 'creator'],
    description: 'Comparte la información de contacto del desarrollador mediante una tarjeta vCard interactiva, facilitando el acceso directo a sus datos de contacto.',
    category: 'main',
    usage: 'creador',
    script: async (m, { sock }) => {
        const owners = {
            syllname: "Syllkom - Owner",
            syllnum: "573113825327",
            syllmail: "Syllkom@proton.me",
            syllurl: "https://syllkom.vercel.app"
        }
        
        const Syllkom = [
            'BEGIN:VCARD',
            'VERSION:3.0',
            `N:${owners.syllname};;;;`,
            `FN:${owners.syllname}`,
            `ORG:${owners.syllorg || 'HorekuOs'}`,
            'TITLE:Developer',
            `item1.TEL;waid=${owners.syllnum}:${owners.syllnum}`,
            'item1.X-ABLabel:Móvil',
            `X-WA-BIZ-NAME:${owners.syllname}`,
            'X-WA-BIZ-DESCRIPTION:Full Stack Developer',
            'END:VCARD'
        ].join('\n')

        const botPP = await sock.profilePictureUrl(sock.user.id, 'image').catch(() => 'https://files.catbox.moe/obz4b4.jpg')
            const fakeQuoted = await sock.fakeOrder(m.chat.id, {
                image: botPP,
                message: 'Syllkom - Owner',
                orderTitle: 'HorekuOs Store',
                price: 37400000,
                currency: 'ARS'
            })

        await sock.sendMessage(m.chat.id, { 
            contacts: { 
                displayName: owners.syllname, 
                contacts: [{ vcard: Syllkom }] 
            }
        }, { quoted: fakeQuoted })
    }
}