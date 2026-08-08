// ./core/library/bootPrompt.js
import { createInterface } from 'readline/promises'
import fs from 'fs'
import path from 'path'
import os from 'os'
import chalk from 'chalk'

const asciiRaw = `
           -+@@@@+-               
         @@@@@@@@@@@@             
     +#@@@@@@@@@@@@@@@@@*         
 :=@@@@@@@@@@%##@@@@@@@@@@@*:     
*@@@@@@@@@@:.    .:@@@@@@@@@@+    
*@@@@@@*+            +*@@@@@@*    
*@@@@@*                +@@@@@*
*@@@@@+                +@@@@@*     
*@@@@@+                +@@@#       
*@@@@@+                +-: +%*     
*@@@@@+                 -@@@@*     
*@@@@@+               :@@@@@@*     
*@@@@@+           .#@@@@@@@%      
.:@@@@+        *#@@@@@@@@:         
    +*+     +@@@@@@@@#:            
         -@@@@@@@@@-               
       =@@@@@@@@+-                 
`

const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatUptime = (seconds) => {
    const d = Math.floor(seconds / (3600 * 24))
    const h = Math.floor((seconds % (3600 * 24)) / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return `${d > 0 ? d + 'd ' : ''}${h > 0 ? h + 'h ' : ''}${m}m`
}

const countFiles = (dir) => {
    if (!fs.existsSync(dir)) return 0
    let count = 0
    try {
        const files = fs.readdirSync(dir)
        for (const file of files) {
            const fullPath = path.join(dir, file)
            if (fs.statSync(fullPath).isDirectory()) count += countFiles(fullPath)
            else if (file.endsWith('.js')) count++
        }
    } catch (e) {}
    return count
}

const formatLine = (label, value, width = 11) => {
    return chalk.bold.blue(label.padEnd(width, ' ')) + chalk.white(': ') + value
}

export const printNeofetch = () => {
    let pkg = { name: 'Aethero', version: '1.0.0' }
    try {
        pkg = JSON.parse(fs.readFileSync(path.resolve('./package.json'), 'utf-8'))
    } catch (e) {}

    const pluginsCount = countFiles(path.resolve('./plugins'))
    const scrapersCount = countFiles(path.resolve('./scrapers'))

    const osType = os.type() === 'Linux' ? 'GNU/Linux' : os.type()
    const osArch = os.arch()
    const cpuModel = os.cpus()[0]?.model.replace(/\s+/g, ' ').trim() || 'Desconocido'
    const totalRam = formatBytes(os.totalmem())
    const usedRam = formatBytes(os.totalmem() - os.freemem())
    const botRam = formatBytes(process.memoryUsage().rss)

    const infoLines = [
        `${chalk.bold.cyan(pkg.name)}${chalk.white('@')}${chalk.bold.magenta(os.hostname())}`,
        chalk.gray('-----------------------------------'),
        formatLine('OS', `${osType} (${osArch})`),
        formatLine('Kernel', os.release()),
        formatLine('Host', `Aethero Engine v${pkg.version}`),
        formatLine('Uptime', formatUptime(os.uptime())),
        formatLine('CPU', cpuModel),
        formatLine('RAM (Sys)', `${usedRam} / ${totalRam}`),
        formatLine('RAM (Bot)', botRam),
        formatLine('Database', 'Hyper-DB (LMDB Native)'),
        formatLine('Plugins', `${pluginsCount} cargados`),
        formatLine('Scrapers', `${scrapersCount} cargados`),
        formatLine('Prefixes', global.config?.prefixes || 'No definido'),
        formatLine('Node.js', process.version),
        formatLine('PID', process.pid.toString()),
        '',
        `${chalk.bgRed('   ')}${chalk.bgGreen('   ')}${chalk.bgYellow('   ')}${chalk.bgBlue('   ')}${chalk.bgMagenta('   ')}${chalk.bgCyan('   ')}${chalk.bgWhite('   ')}`
    ]

    const asciiArray = asciiRaw.split('\n').filter(line => line.trim() !== '' || line.length > 0)
    const leftWidth = 35

    console.log('\n')
    const maxLines = Math.max(asciiArray.length, infoLines.length)
    for (let i = 0; i < maxLines; i++) {
        const left = chalk.cyan((asciiArray[i] || '').padEnd(leftWidth, ' '))
        const right = infoLines[i] || ''
        console.log(`${left}  ${right}`)
    }
    console.log('\n')
}

export const runBootPrompt = async (storagePath = './storage') => {
    console.clear()
    printNeofetch()

    const sessionFile = path.resolve(storagePath, 'creds/main/session.json')
    const oldCreds = path.resolve(storagePath, 'creds/creds.json')

    if (fs.existsSync(sessionFile) || fs.existsSync(oldCreds)) {
        return null
    }

    const readline = createInterface({
        input: process.stdin,
        output: process.stdout
    })

    const question = (text) => readline.question(text)

    while (true) {
        let text = '\n\n'
        text += chalk.redBright('╭╼◯') + chalk.white(' Aethero / ') + chalk.greenBright('Conexión') + '\n'
        text += chalk.redBright('╷') + chalk.white(' Seleccione un método para vincular:\n')
        text += chalk.redBright('├╶╶╶✦\n')
        text += chalk.redBright('╵⌬ ') + chalk.greenBright('1. Código QR\n')
        text += chalk.redBright('╵⌬ ') + chalk.greenBright('2. Código de 8 dígitos (Pin)\n')
        text += chalk.redBright('╰────────────────────────────◯\n\n')
        text += chalk.cyanBright('~> Opción: ')

        const opcion = (await question(text)).trim()
        if (opcion === 'exit') break

        if (opcion === '1') {
            readline.close()
            return { connectType: 'qr-code', phoneNumber: '' }
        }

        if (opcion === '2') {
            while (true) {
                let txtNum = '\n' + chalk.redBright('~>') + ' Escribe el número del Bot (Ej: 51999999999)\n'
                txtNum += chalk.gray('(Escriba "back" para volver al menú)\n')
                txtNum += chalk.redBright('~> ')

                let numero = await question(txtNum)
                numero = numero.trim()

                if (numero.toLowerCase() === 'back') break
                if (!numero || isNaN(numero.replace(/\+/g, ''))) {
                    console.log(chalk.yellowBright('\nⓘ El número es obligatorio y debe ser válido.'))
                    continue
                }

                readline.close()
                return { connectType: 'pin-code', phoneNumber: numero }
            }
        } else {
            console.log(chalk.yellowBright('\nⓘ Opción no válida. Ingresa 1 o 2.'))
        }
    }

    readline.close()
    return { connectType: 'qr-code', phoneNumber: '' }
}