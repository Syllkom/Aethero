// ./index.js
await import('./config.js')

import path from "path";
import chalk from "chalk";

import { CoreI } from "./core/index.js";

const bot = new CoreI(null, {
    STORAGE: path.resolve('./storage'),
    CONFIG: path.resolve('./config.js'),
    MODULEREGISTRY: [
        {
            folder: path.resolve('./plugins'),
            suffix: '.plugin.js',
            defaultContext: {
                usePrefix: true,
                stubtype: false,
                command: false,
            }
        }, {
            mainLogic: true,
            folder: path.resolve('./handlers'),
            suffix: '.handler.js',
            defaultContext: {
                enabled: true
            }
        }
    ]
})

await bot.start()

/*// libreria
import runQuestion from './library/setup.js';
import { ForkManager } from './core/library/MakeFork.js';

let _runQuestion = await runQuestion()
const modulePath = path.resolve('./core/main.js')

async function startMain() {
    const mainBot = new ForkManager(modulePath, {
        execArgv: ['--max-old-space-size=512'],
        cwd: path.dirname('./'),
        serialization: 'json',
        // silent: true,
        env: {
            connOptions: { ..._runQuestion }
        }
    })

    mainBot.event.set('message', async (m) => {
        switch (m.type) {
            case 'open': {
                console.log(chalk.rgb(70, 209, 70)('Connection open:'), {
                    ...m.data
                });
            } break
            case 'close': {
                console.log(chalk.rgb(201, 54, 54)('Connection close:'), {
                    ...m.data
                });
            } break
            case 'pairing': {
                if (m.event === 'qr-code') {
                    console.log(chalk.rgb(16, 61, 207)('qr code:'));
                    console.log(m.data.qrCodeText);
                }
                else if (m.event === 'pin-code') {
                    console.log(chalk.rgb(16, 61, 207)('pin code:'));
                    console.log(m.data.formattedCode);
                }
            }
        }
    });

    mainBot.event.set('exit', async ({ code, signal }) => {
        console.log({ code, signal });
        await new Promise(resolve =>
            setTimeout(resolve, 2000));
        await mainBot.start();
    });

    mainBot.event.set('error', (e) => {
        console.error(`Error:`, e)
    });

    await mainBot.start()
}

await startMain()*/