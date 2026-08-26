// ./library/media/ffmpegResolver.js
import { execSync } from 'child_process'
import fs from 'fs'
import chalk from 'chalk'

let cachedFFmpegPath = null

export function getFFmpegPath() {
    if (cachedFFmpegPath) return cachedFFmpegPath

    try {
        const cmd = process.platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg'
        const systemPath = execSync(cmd, { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim().split('\n')[0]
        if (systemPath && fs.existsSync(systemPath)) {
            cachedFFmpegPath = systemPath
            return cachedFFmpegPath
        }
    } catch {}

    try {
        const staticMod = import('ffmpeg-static')
        const staticPath = staticMod?.default || staticMod
        if (typeof staticPath === 'string' && fs.existsSync(staticPath)) {
            cachedFFmpegPath = staticPath
            return cachedFFmpegPath
        }
    } catch {}

    console.warn(chalk.yellowBright('\nⓘ [Aviso FFmpeg]: No se detectó FFmpeg en el sistema.'))
    if (process.platform === 'android' || process.env.PREFIX?.includes('com.termux')) {
        console.warn(chalk.cyanBright('ⓘ En Termux ejecuta: pkg install ffmpeg\n'))
    } else {
        console.warn(chalk.cyanBright('ⓘ En Linux ejecuta: sudo apt install ffmpeg\n'))
    }

    cachedFFmpegPath = 'ffmpeg'
    return cachedFFmpegPath
}

export default getFFmpegPath