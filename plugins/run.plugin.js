import { exec } from 'child_process'
import util from 'util'

const execPromise = util.promisify(exec);

const plugin = {
    case: ['>', '$'],
    usage: ['> <script>', '$ <shell>'],
    category: ['owner'],
    usePrefix: false,
    command: true
}

plugin.script = async (m, { sock }) => {
    try {
        if (m.body.startsWith('>')) {
            let evaled = await eval(`${m.body.slice(2)}`)
            if (typeof evaled !== 'string') evaled = util.inspect(evaled, { depth: 1 });
            if (evaled !== 'undefined') await sock.sendMessage(m.chat.id,
                { text: evaled }, { quoted: m.raw })
        }
        else if (m.body.startsWith('$')) {
            let shellCommand = (m.body.trim()).slice(1).trim();
            let { stdout, stderr } = await execPromise(shellCommand);
            let response = stdout || stderr || 'No output';
            await sock.sendMessage(m.chat.id, { text: response.trim() }, { quoted: m.raw })
        }
    } catch (err) {
        await sock.sendMessage(m.chat.id, { text: String(err) }, { quoted: m.raw })
    }
}

export default plugin