import {
    createInterface
} from 'readline/promises'

const control = {
    continue: () => [1],
    resolve: (any) => [2, any],
    close: () => [0],
}

const readline = createInterface({
    input: process.stdin,
    output: process.stdout
})

export const PromptLoop = (text) => ({
    run: async (func) => {
        if (Array.isArray(text)) text = text.filter(
            (o) => typeof o === 'string').join('\n')
        if (typeof text !== 'string') return

        while (true) {
            let ques = (await readline.question(text)).trim()
            const result = await func.call(control, ques, control)
            if (!Array.isArray(result)) continue
            if (result[0] === 2) return (readline.close(), result[1])
            if (result[0] === 0) return (readline.close(), 0)
        }
    }
})

