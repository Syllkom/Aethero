// ./node_modules/baileys-ipc/BaileysIPC/Library/IPCProxy.js

function sanitizeForIPC(obj, seen = new WeakSet()) {
    if (obj === null || obj === undefined) return obj
    if (typeof obj === 'function') return undefined
    if (typeof obj === 'bigint') return obj.toString()
    if (typeof obj !== 'object') return obj

    if (seen.has(obj)) return undefined
    seen.add(obj)

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeForIPC(item, seen))
    }

    const clean = {}
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'function') continue
        clean[key] = sanitizeForIPC(value, seen)
    }
    return clean
}

export class IPCProxy {
    constructor(sendCallback, Intercept = {}) {
        this.send = sendCallback;
        this.intercept = Intercept;
        this.objects = {};
        return this.Proxy([]);
    }

    Proxy(path) {
        const get = (target, prop) => {
            if (typeof prop === 'symbol')
                return Reflect.get(target, prop);

            if (prop === 'then') {
                if (path.length === 0) return undefined;
                else return (resolve, reject) => {
                    const lastProp = path[path.length - 1];
                    if (this.intercept[lastProp]) return Promise.resolve(
                        this.intercept[lastProp]).then(resolve);
                    Promise.resolve(this.send({
                        ARGS: undefined, type: 'SOCKET', PATH: path
                    })).then(resolve).catch(reject);
                };
            }

            if (path.length === 0 && this.objects[prop] !== undefined)
                return this.objects[prop];
            return this.Proxy([...path, prop]);
        }

        return new Proxy(() => { }, {
            get,
            apply: (target, thisArg, args) => {
                const lastProp = path[path.length - 1];
                if (this.intercept[lastProp]) {
                    if (typeof this.intercept[lastProp] === 'function')
                        return this.intercept[lastProp](...args);
                    return this.intercept[lastProp];
                } else {
                    const cleanArgs = args.length > 0 ? sanitizeForIPC(args) : undefined;
                    return this.send({
                        ARGS: cleanArgs,
                        type: 'SOCKET',
                        PATH: path,
                    });
                }
            },
            set: (target, key, value) => {
                if (path.length === 0)
                    this.objects[key] = value;
                return true;
            },
            deleteProperty: (target, key) => {
                if (path.length === 0)
                    delete this.objects[key];
                return true;
            }
        });
    }
}