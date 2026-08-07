import got from 'got';

export default {
    case: ['testa'],
    command: true,
    async script(m, { sock, plugin }) {
        await sock.sendMessage(m.chat.id, { text: 'te amo Zeppth' }, { quoted: m.raw })
    }
}


/*const _0x30fefd = _0x2d07, outStream = new PassThrough(), chunks = []; let nextIndex = 0x0; function _0x2d07(_0x362575, _0x24629a) { const _0x2d076f = _0x2462(); return _0x2d07 = function (_0x5a9e9b, _0x5cc473) { _0x5a9e9b = _0x5a9e9b - 0x19f; let _0x3da503 = _0x2d076f[_0x5a9e9b]; return _0x3da503; }, _0x2d07(_0x362575, _0x24629a); } function _0x2462() { const _0x2729f9 = ['all', 'destroy', 'then', 'write', 'body', 'from', 'catch', 'getInfo']; _0x2462 = function () { return _0x2729f9; }; return _0x2462(); } this[_0x30fefd(0x1a6)](url)[_0x30fefd(0x1a1)](({ size: _0x398927, headers: _0x5e905f }) => { const _0x108407 = _0x30fefd, _0x2d83d5 = Math['ceil'](_0x398927 / threads), _0x3798f = Array[_0x108407(0x1a4)]({ 'length': threads }, (_0x83a86a, _0x721bcb) => { const _0x376804 = { _0x44f02a: 0x1a3 }, _0xede1ca = _0x108407, _0x3c2fc1 = _0x721bcb * _0x2d83d5, _0x33dafe = _0x721bcb === threads - 0x1 ? _0x398927 - 0x1 : _0x3c2fc1 + _0x2d83d5 - 0x1; return got(url, { 'headers': { ..._0x5e905f, 'Range': 'bytes=' + _0x3c2fc1 + '-' + _0x33dafe }, 'responseType': 'buffer', 'retry': { 'limit': 0x3 } })[_0xede1ca(0x1a1)](_0x56bc9b => { const _0x1c74d4 = _0xede1ca; chunks[_0x721bcb] = _0x56bc9b[_0x1c74d4(_0x376804._0x44f02a)]; while (chunks[nextIndex]) { outStream[_0x1c74d4(0x1a2)](chunks[nextIndex]), chunks[nextIndex] = null, nextIndex++; } }); }); Promise[_0x108407(0x19f)](_0x3798f)[_0x108407(0x1a1)](() => outStream['end']())[_0x108407(0x1a5)](_0x16d637 => outStream[_0x108407(0x1a0)](_0x16d637)); })[_0x30fefd(0x1a5)](_0x5e098f => outStream[_0x30fefd(0x1a0)](_0x5e098f)); return outStream;*/