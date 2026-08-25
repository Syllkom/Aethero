// ./library/scrapers/tools/tourl.scraper.js
import got from 'got'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

async function uploadQuax(buffer, filename = 'file.bin') {
    const fd = new FormData()
    fd.append('files[]', new Blob([buffer]), filename)

    const res = await fetch('https://qu.ax/upload.php', {
        method: 'POST',
        body: fd,
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(25000)
    })

    const json = await res.json()
    if (json?.success && json.files?.[0]?.url) {
        return { status: true, url: json.files[0].url, host: 'qu.ax' }
    }
    throw new Error('Fallo en Qu.ax')
}

async function uploadUguu(buffer, filename = 'file.bin') {
    const fd = new FormData()
    fd.append('files[]', new Blob([buffer]), filename)

    const res = await fetch('https://uguu.se/upload.php', {
        method: 'POST',
        body: fd,
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(25000)
    })

    const json = await res.json()
    if (json?.success && json.files?.[0]?.url) {
        return { status: true, url: json.files[0].url, host: 'uguu.se' }
    }
    throw new Error('Fallo en Uguu.se')
}

async function uploadCatbox(buffer, filename = 'file.bin') {
    const fd = new FormData()
    fd.append('reqtype', 'fileupload')
    fd.append('fileToUpload', new Blob([buffer]), filename)

    const res = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: fd,
        headers: { 'User-Agent': UA, 'Origin': 'https://catbox.moe', 'Referer': 'https://catbox.moe/' },
        signal: AbortSignal.timeout(20000)
    })

    const body = (await res.text()).trim()
    if (res.ok && /^https?:\/\/(files|litter)\.catbox\.moe\/\S+$/.test(body)) {
        return { status: true, url: body, host: 'catbox.moe' }
    }
    throw new Error(`Catbox error (${res.status}): ${body.slice(0, 100)}`)
}

export async function upload(buffer, filename = 'media.bin') {
    if (!buffer || !Buffer.isBuffer(buffer)) {
        return { status: false, msg: 'Buffer de archivo inválido.' }
    }

    try {
        const qRes = await uploadQuax(buffer, filename)
        if (qRes.status) return qRes
    } catch {}

    try {
        const cRes = await uploadCatbox(buffer, filename)
        if (cRes.status) return cRes
    } catch {}

    try {
        const uRes = await uploadUguu(buffer, filename)
        if (uRes.status) return uRes
    } catch {}

    return { status: false, msg: 'Todos los servidores de subida fallaron o rechazaron el archivo.' }
}

export default {
    upload
}