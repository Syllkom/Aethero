import { PassThrough } from 'node:stream';
import https from 'node:https';
import http from 'node:http';
import got from 'got';

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

const URL = {
    async getInfo(url) {
        const _0x5cd713 = _0x4d20, headers = { 'User-Agent': _0x5cd713(0x15d), 'Referer': 'https://www.youtube.com/', 'Origin': _0x5cd713(0x15c) }; function _0x4d20(_0x148c40, _0x431bf0) { const _0x4d2052 = _0x431b(); return _0x4d20 = function (_0x2cb7b0, _0x2f0afc) { _0x2cb7b0 = _0x2cb7b0 - 0x15c; let _0x16a6b4 = _0x4d2052[_0x2cb7b0]; return _0x16a6b4; }, _0x4d20(_0x148c40, _0x431bf0); } function _0x431b() { const _0x4e695b = ['https://www.youtube.com', 'Mozilla/5.0\x20(Windows\x20NT\x2010.0;\x20Win64;\x20x64)\x20AppleWebKit/537.36\x20(KHTML,\x20like\x20Gecko)\x20Chrome/110.0.0.0\x20Safari/537.36', 'headers', 'content-length', 'head']; _0x431b = function () { return _0x4e695b; }; return _0x431b(); } try { const response = await got[_0x5cd713(0x160)](url, { 'headers': headers, 'retry': { 'limit': 0x2 } }), size = parseInt(response[_0x5cd713(0x15e)][_0x5cd713(0x15f)], 0xa); if (isNaN(size)) throw undefined; return { 'size': size, 'headers': headers }; } catch (_0x27bb95) { throw undefined; }
    },

    getStream(url, threads = 4) {
        const _0x1a8284 = _0x2dd7, outStream = new PassThrough(), CHUNK_SIZE = 0x5 * 0x400 * 0x400, storage = new Map(); function _0x265b() { const _0x557d3f = ['write', 'has', 'buffer', 'min', 'set', 'ceil', 'then', 'body', 'destroy', 'getInfo', 'bytes=', 'get']; _0x265b = function () { return _0x557d3f; }; return _0x265b(); } let nextIndexToEmit = 0x0, globalIndexCounter = 0x0, isDestroyed = ![]; function _0x2dd7(_0x77ca45, _0x265b84) { const _0x2dd795 = _0x265b(); return _0x2dd7 = function (_0xdff73c, _0xf1bc90) { _0xdff73c = _0xdff73c - 0x152; let _0x5d3bbc = _0x2dd795[_0xdff73c]; return _0x5d3bbc; }, _0x2dd7(_0x77ca45, _0x265b84); } this[_0x1a8284(0x15b)](url)[_0x1a8284(0x158)](({ size: _0x8d802e, headers: _0x5e7773 }) => { const _0x386207 = { _0x3fc9a2: 0x159, _0x184e45: 0x152 }, _0x3a290d = _0x1a8284, _0x2953ce = Math[_0x3a290d(0x157)](_0x8d802e / CHUNK_SIZE), _0x29b23b = async () => { const _0x2eb91d = _0x3a290d; while (globalIndexCounter < _0x2953ce && !isDestroyed) { const _0x181011 = globalIndexCounter++, _0x4dce8b = _0x181011 * CHUNK_SIZE, _0xee80a0 = Math[_0x2eb91d(0x155)](_0x4dce8b + CHUNK_SIZE - 0x1, _0x8d802e - 0x1); try { const _0xd3cbca = await got(url, { 'headers': { ..._0x5e7773, 'Range': _0x2eb91d(0x15c) + _0x4dce8b + '-' + _0xee80a0 }, 'responseType': _0x2eb91d(0x154), 'retry': { 'limit': 0x3 } }); storage[_0x2eb91d(0x156)](_0x181011, _0xd3cbca[_0x2eb91d(_0x386207._0x3fc9a2)]); while (storage[_0x2eb91d(0x153)](nextIndexToEmit)) { const _0x1c269d = storage[_0x2eb91d(0x15d)](nextIndexToEmit); outStream[_0x2eb91d(_0x386207._0x184e45)](_0x1c269d), storage['delete'](nextIndexToEmit), nextIndexToEmit++; } nextIndexToEmit === _0x2953ce && outStream['end'](); } catch (_0x1d7d83) { isDestroyed = !![], outStream['destroy'](_0x1d7d83); } } }; for (let _0x3ad4a1 = 0x0; _0x3ad4a1 < threads; _0x3ad4a1++) { _0x29b23b(); } })['catch'](_0x31a89e => outStream[_0x1a8284(0x15a)](_0x31a89e)); return outStream;
    },
    async getBuffer(url, threads = 4) {
        function _0x2071(_0x48ed0a, _0x326d6b) { const _0x2071db = _0x326d(); return _0x2071 = function (_0x1cb5a1, _0x4b71b2) { _0x1cb5a1 = _0x1cb5a1 - 0x86; let _0x4fc9c0 = _0x2071db[_0x1cb5a1]; return _0x4fc9c0; }, _0x2071(_0x48ed0a, _0x326d6b); } const _0x1b6f04 = _0x2071, { size, headers: baseHeaders } = await this['getInfo'](url), chunkSize = Math['ceil'](size / threads), promises = Array[_0x1b6f04(0x86)]({ 'length': threads }, (_0x50d092, _0x46bce4) => { const _0x336a77 = { _0x232d74: 0x8a }, _0x2908c1 = _0x1b6f04, _0x3ac59b = _0x46bce4 * chunkSize, _0x156c7f = _0x46bce4 === threads - 0x1 ? size - 0x1 : _0x3ac59b + chunkSize - 0x1; return got(url, { 'headers': { ...baseHeaders, 'Range': _0x2908c1(0x88) + _0x3ac59b + '-' + _0x156c7f }, 'responseType': _0x2908c1(_0x336a77._0x232d74) })['then'](_0x2c81a0 => _0x2c81a0[_0x2908c1(0x87)]); }), results = await Promise[_0x1b6f04(0x89)](promises); return Buffer[_0x1b6f04(0x8b)](results); function _0x326d() { const _0xe0109b = ['from', 'body', 'bytes=', 'all', 'buffer', 'concat']; _0x326d = function () { return _0xe0109b; }; return _0x326d(); }
    }
}

export default {
    export: {
        ytdl: async function (url) {
            const API = `https://nayan-video-downloader.vercel.app`
            const data = (await got(`${API}/youtube?url=${encodeURIComponent(url)}`, {
                headers: { 'Accept': 'application/json' }, responseType: 'json'
            }))?.body;

            if (!data && !data.data) return false
            if (!data.data.formats?.length) return false

            const videos = data.data.formats.filter((o) =>
                o.type === 'video_with_audio').map((o) => {
                    const stream = () => URL.getStream(o.url)
                    const buffer = async () => URL.getBuffer(o.url)
                    return { ...o, download: { stream, buffer } };
                })

            const audios = data.data.formats.filter(
                (o) => o.ext == 'opus').map((o) => {
                    const stream = () => URL.getStream(o.url)
                    const buffer = async () => URL.getBuffer(o.url)
                    return { ...o, download: { stream, buffer } };
                })

            return {
                ...data.data,
                videos,
                audios
            }
        }
    }
}


//const data = plugin.import('ytdl')('https://www.youtube.com/watch?v=...')

// data.audios[0].download.stream() no es asincrona no uses await
// await data.audios[0].download.buffer() es asincrona usa await siempre

// para sacar el tipo
//const mimeType = data.audios[0].mimeType.split(';')[0]

/*await sock.sendMessage(m.chat.id, {
    document: { stream: data.audios[1].download.stream() },
    fileName: data.title + '.opus', // titulo
    mimetype: 'audio/mpeg', o mimeType
}, { quoted: m.message });*/


// data tiene esta estructura

/*const data = {
    videoId: 'Y95KZ4sm-i8',
    title: 'Solitario - La pseudociencia [ Letra ] (Prod. Mees Bickle)',
    author: 'Solitario',
    author_url: 'https://www.youtube.com/@solitario452',
    thumbnail: 'https://i.ytimg.com/vi/Y95KZ4sm-i8/hqdefault.jpg',
    provider: 'YouTube',
    videos: [{
        formatId: 18,
        label: 'mp4 (360p)',
        type: 'video_with_audio',
        ext: 'mp4',
        quality: '360p',
        width: 640,
        height: 360,
        url: 'https://redirector.googlevideo.com/videoplayback?expire=1774080382&ei=Hv29aZTeBMTfvdIPlqPAoQw&....',
        bitrate: 218293,
        fps: 30,
        audioQuality: 'AUDIO_QUALITY_LOW',
        audioSampleRate: '44100',
        mimeType: 'video/mp4; codecs="avc1.42001E, mp4a.40.2"',
        duration: 24,
        download: {
            stream: Function,
            buffer: Function
        }
    }],
    audios: [{
        formatId: 249,
        label: 'opus (66kb/s)',
        type: 'audio',
        ext: 'opus',
        width: null,
        height: null,
        url: 'https://redirector.googlevideo.com/videoplayback?expire=1774080382&ei=Hv29aZTeBMTfvdIPlqPAoQw&...',
        bitrate: 66047,
        fps: null,
        audioQuality: 'AUDIO_QUALITY_LOW',
        audioSampleRate: '48000',
        mimeType: 'audio/webm; codecs="opus"',
        duration: 24,
        download: {
            stream: Function,
            buffer: Function
        }
    },
    {
        formatId: 251,
        label: 'opus (168kb/s)',
        type: 'audio',
        ext: 'opus',
        width: null,
        height: null,
        url: 'https://redirector.googlevideo.com/videoplayback?expire=1774080382&ei=Hv29aZTeBMTfvdIPlqPAoQw&...',
        bitrate: 168380,
        fps: null,
        audioQuality: 'AUDIO_QUALITY_MEDIUM',
        audioSampleRate: '48000',
        mimeType: 'audio/webm; codecs="opus"',
        duration: 24,
        download: {
            stream: Function,
            buffer: Function
        }
    }]
}*/
