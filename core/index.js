import path from 'path';
import { ForkManager } from "./library/MakeFork.js";
import { PromptLoop } from './library/Question.js';
import chalk from 'chalk';
import fs from 'fs';

async function EventMessage(m) {
    switch (m.type) {
        case 'open': console.log(chalk.rgb(70, 209, 70)(
            'Connection open:'), { ...m.data }); break
        case 'close': console.log(chalk.rgb(201, 54, 54)(
            'Connection close:'), { ...m.data }); break

        case 'pairing': {
            if (m.event === 'qr-code') (console.log(chalk.
                rgb(16, 61, 207)('qr code:')), console.log(m.data.qrCodeText))
            else if (m.event === 'pin-code') (console.log(chalk.
                rgb(16, 61, 207)('pin code:')), console.log(m.data.formattedCode))
        }
    }
}

export class CoreI {
    constructor(modulePath, env, options) {
        this.modulePath = modulePath ?? path
            .resolve('./core/main.js');
        this.options = options;
        this.fork = null;
        this.env = env;
    }

    async stop() {
        await this.fork.stop()
        return true;
    }

    async start() {
        let env = this.env ?? {}
        if (!env.connOptions?.connectType) Object
            .assign(env, { connOptions: await Prompt(env) })

        this.fork = new ForkManager(this.modulePath, {
            execArgv: ['--max-old-space-size=512'],
            cwd: path.resolve(process.cwd()), serialization: 'json',
            ...(this.options || {}), env: { ...env },
        })

        await this.Event();
        await this.fork.start();
    }

    Event() {
        this.fork.event.set('message', async (m) => {
            await EventMessage(m)
        });

        this.fork.event.set('exit', async ({ code, signal }) => {
            console.log({ code, signal });
            await new Promise(resolve => setTimeout(resolve, 2000));
            await this.fork.start();
        });

        this.fork.event.set('error', (e) => {
            console.error(`Error:`, e)
        });
    }
}

async function Prompt(env) {
    const creds = path.join(env.STORAGE, 'creds/creds.json')
    if (fs.existsSync(creds)) return null

    const menu = PromptLoop([
        '\n\x1b[1;31m~\x1b[1;37m> ¿Cómo desea conectarse?',
        '1. Código QR.', '2. Código de 8 dígitos.',
        'Escriba "exit" para cancelar.',
        '\x1b[1;31m~\x1b[1;37m> '
    ]);

    return await menu.run(async function (opcion) {
        if (opcion === 'exit') return this.close();
        if (opcion === '1') return this.resolve({
            connectType: 'qr-code',
            phoneNumber: ''
        });


        if (opcion === '2') {
            const submenu = PromptLoop([
                '\n\x1b[1;31m~\x1b[1;37m> ¿Cuál es el número que desea asignar como Bot?',
                '(Escriba "back" para volver)', '\x1b[1;31m~\x1b[1;37m> '
            ]);

            const numeroResult = await submenu.run(async function (numero) {
                if (numero.toLowerCase() === 'back') return this.resolve('__BACK__');
                if (!numero) return (console.log('\x1b[1;33mEl número es obligatorio.'
                    + ' Por favor ingrese un número válido.\x1b[0m'), this.continue())
                return this.resolve(numero);
            });

            if (numeroResult === '__BACK__') return this.continue();

            return this.resolve({
                connectType: 'pin-code',
                phoneNumber: numeroResult
            });
        }

        console.log('\x1b[1;33mOpción no válida. '
            + ' Intente de nuevo.\x1b[0m');
        return this.continue();
    });
};