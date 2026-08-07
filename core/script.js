import fs from 'fs/promises';
import path from 'path';;

const CONFIG = {
    outputFile: 'core.txt',
    maxFileSize: 1024 * 1024,
    excludedExtensions: ['.jpg', '.png', '.gif', '.mp4', '.mp3', '.exe', '.dll', '.ico', '.svg'],
    includeHidden: false,
};

const ignore = {
    files: [
        CONFIG.outputFile,
        'LICENSE',
        'README.md',
        'script.js',
        'test.js',
    ]
};

function $a(e, t) { return t.some(r => { if (r.includes('*')) { let n = new RegExp('^' + r.replace(/\*/g, '.*') + '$'); return n.test(e) } return e === r }) } function $b(e) { return !CONFIG.excludedExtensions.includes(path.extname(e).toLowerCase()) } function $c(e, t = 0, n = "") { let r = "", i = e.filter(e => e.esDirectorio).sort((e, t) => e.nombre.localeCompare(t.nombre)), o = e.filter(e => !e.esDirectorio).sort((e, t) => e.nombre.localeCompare(t.nombre)), s = [...i, ...o]; for (let l = 0; l < s.length; l++) { let u = s[l], a = l === s.length - 1, d = n; t > 0 && (d += a ? "    " : "│   "); if (u.esDirectorio) { r += `${n}${a ? "└── " : "├── "}${u.nombre}/\n`; r += $c(u.contenido, t + 1, d) } else r += `${n}${a ? "└── " : "├── "}${u.nombre}\n` } return r } async function $d(e) { let t = [], n = path.basename(e); try { let r = await fs.readdir(e, { withFileTypes: !0 }), i = ignore.files || [], o = ignore[n]?.files || [], s = [...i, ...o]; for (let l of r) { if (!CONFIG.includeHidden && l.name.startsWith('.')) continue; if (s.includes(l.name)) continue; if ($a(l.name, ignore.patterns || [])) continue; if (l.isDirectory()) { let u = await $d(path.join(e, l.name)); t.push({ nombre: l.name, esDirectorio: !0, contenido: u, rutaCompleta: path.join(e, l.name) }) } else t.push({ nombre: l.name, esDirectorio: !1, rutaCompleta: path.join(e, l.name) }) } } catch (r) { t.push({ nombre: `[Error leyendo: ${n}]`, esDirectorio: !1, error: !0 }) } return t } async function $e(e) { let t = ""; for (let n of e) { if (n.error) continue; if (n.esDirectorio) { let r = await $e(n.contenido); t += r } else try { if ($b(n.nombre)) { let r = await fs.stat(n.rutaCompleta); if (r.size <= CONFIG.maxFileSize) { let i = await fs.readFile(n.rutaCompleta, 'utf-8'), o = i.split('\n'); t += `\n${n.rutaCompleta}\n`; t += `${'_'.repeat(8)}\n`; o.forEach((e, r) => { let l = (r + 1).toString().padStart(4); t += `${l} | ${e}\n` }); t += `${'_'.repeat(8)}\n` } } } catch (r) { } } return t } async function $f() { try { let e = path.basename(process.cwd()), t = await $d('.'), n = $c(t), r = await $e(t), i = `Fecha: ${new Date().toLocaleString()}\n`; i += `Carpeta: ${e}\n\n`; i += `${'='.repeat(20)}\n\n`; i += `${e}/\n`; i += n; i += `\n${'='.repeat(20)}\n`; i += r; await fs.writeFile(CONFIG.outputFile, i); console.log('Archivo generado:', CONFIG.outputFile) } catch (e) { console.error('Error:', e.message); process.exit(1) } } $f();