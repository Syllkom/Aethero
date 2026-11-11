// ./node_modules/baileys-ipc/BaileysIPC/Library/IPCWorker.js

import path from "path";
import { Worker } from "worker_threads";

export class IPCWorker {
    constructor(filePath, options) {
        if (typeof options == 'undefined')
            throw new Error('options:required');

        this.filePath = path.resolve(filePath);
        this.status = 'stop';
        this.options = options;
        this.startTime = null;
        this.worker = null;

        this.eventExit = null;
        this.eventMessage = null;
        this.eventError = null;
    }

    get uptime() {
        if (!this.startTime) return null;
        return Date.now() - this.startTime;
    }

    send(data, transferList) {
        if (!this.worker) return null;
        try {
            if (Array.isArray(transferList) && transferList.length > 0) {
                return this.worker.postMessage(data, transferList);
            }
            return this.worker.postMessage(data);
        } catch (e) {
            try {
                const safeData = JSON.parse(JSON.stringify(data, (key, value) => {
                    if (typeof value === 'function') return undefined;
                    if (typeof value === 'bigint') return value.toString();
                    return value;
                }));
                return this.worker.postMessage(safeData);
            } catch (err) {
                return console.error('[IPCWorker Fatal Send Error]:', err);
            }
        }
    }

    ev() {
        if (!this.worker) return;

        this.worker.on('message', async (m) => {
            if (typeof this.eventMessage === 'function') {
                try { return await this.eventMessage(m, this) }
                catch (e) { console.error('Error handling message:', e) }
            }
        });

        this.worker.on('exit', async (code) => {
            if (this.status !== 'stop') setTimeout(
                () => this.start(), 5000);

            if (typeof this.eventExit === 'function') {
                try { return await this.eventExit({ code, signal: null }, this) }
                catch (e) { console.error('Error handling exit event:', e) }
            }
        });

        this.worker.on('error', async (err) => {
            if (typeof this.eventError === 'function') {
                try { return await this.eventError(err, this) }
                catch (e) { console.error('Error handling error event:', e) }
            }
        });
    }

    async stop(func) {
        try {
            this.status = 'stop';
            if (this.worker) await this.worker.terminate();
            this.worker = null;

            if (typeof func === 'function')
                return await func(this);
        } catch (error) {
            console.error('worker stop error', error);
        }
    }

    async start(func) {
        try {
            if (this.worker) await this.stop();
            const development = structuredClone(this.options);
            this.worker = new Worker(this.filePath, { workerData: development });
            this.status = 'running';
            this.startTime = Date.now();
            this.ev();

            if (typeof func === 'function') {
                return await func(this);
            }
        } catch (e) {
            this.status = 'stop';
            console.error('worker start error:', e);
        }
    }
}