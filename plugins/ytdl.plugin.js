import got from 'got';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { PassThrough } from 'stream';
ffmpeg.setFfmpegPath(ffmpegPath);

class sMap {
    constructor(limit = 20) {
        this.limit = limit;
        this.map = new Map();
    }

    get(key) {
        if (!this.map.has(key)) return;
        const value = this.map.get(key);
        this.map.delete(key);
        this.map.set(key, value);
        return value;
    }

    set(key, value) {
        if (this.map.has(key)) this.map.delete(key);
        else if (this.map.size >= this.limit) this.map
            .delete(this.map.keys().next().value);
        this.map.set(key, value);
        return this;
    }

    delete(key) { return this.map.delete(key) }
    get size() { return this.map.size }
    clear() { this.map.clear() }
}

const map = new sMap(20)

/*const storage = process.env.STORAGE
const temp = path.join(storage, 'temp')*/

export default {
    command: true,
    exports: { sMap: sMap },
    case: ['ytmp3', 'ytmp4'],
    async script(m, { sock, plugin }) {
        if (!m.text) return;
        const youtubeUrl = m.args[0]

        if (!map.get(youtubeUrl)) {
            const API = `https://nayan-video-downloader.vercel.app`
            const data = (await got(`${API}/ytdown?url==${encodeURIComponent(youtubeUrl)}`,
                { headers: { 'Accept': 'application/json' }, responseType: 'json' }))?.body;
            map.set(youtubeUrl, data)
        }

        const data = map.get(youtubeUrl)

        if (m.command === 'ytmp4') await sock.sendMessage(m.chat.id, {
            document: { stream: got.stream(data.data.video) },
            fileName: data.data.title + '.mp4', mimetype: 'video/mp4'
        }, { quoted: m.raw });

        if (m.command === 'ytmp3') {
            const outputStream = new PassThrough();
            const inputStream = got.stream(data.data.audio);
            ffmpeg(inputStream).noVideo().audioCodec('aac').format('adts')
                .on('error', (err) => console.error('Error FFmpeg:', err.message))
                .pipe(outputStream, { end: true });

            await sock.sendMessage(m.chat.id, {
                audio: { stream: outputStream }, mimetype: 'audio/aac',
                fileName: (data.data.title || 'audio') + '.m4a', ptt: false
            }, { quoted: m.raw });
        }
    }
}


/*await sock.sendMessage(m.chat.id, {
    document: { stream: got.stream(data.data.audio) },
    fileName: data.data.title + '.m4a', mimetype: 'audio/mp4'
}, { quoted: m.raw });*/

/*await sock.sendMessage(m.chat.id, {
    audio: { stream: got.stream(data.data.audio) },
    mimetype: 'audio/m4a', //'audio/mp4',
    fileName: data.data.title + '.m4a',
    ptt: false 
}, { quoted: m.raw });*/
