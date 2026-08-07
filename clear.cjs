// clear.cjs - Script de limpieza y refactorización ultra seguro
const fs = require('fs');
const path = require('path');

// 1. Mapeo de renombrado de archivos en core/library
const LIBRARY_RENAME_MAP = {
    'MakeFork.js': 'makeFork.js',
    'Message.js': 'message.js',
    'Modules.js': 'modules.js',
    'pathStore.js': 'pathStore.js',
    'Question.js': 'question.js',
    'WAClient.js': 'waClient.js',
    'Watcher.js': 'watcher.js'
};

const LIB_DIR = path.resolve('./core/library');
const ROOT_DIR = path.resolve('./');

// Carpetas a ignorar en el escaneo
const IGNORED_DIRS = new Set(['node_modules', '.git', 'storage', 'dist', 'build']);

/**
 * Obtiene todos los archivos .js / .cjs / .mjs recursivamente
 */
function getAllJSFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (IGNORED_DIRS.has(file)) continue;
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            getAllJSFiles(fullPath, fileList);
        } else if (/\.(js|cjs|mjs)$/i.test(file) && file !== 'clear.cjs') {
            fileList.push(fullPath);
        }
    }
    return fileList;
}

/**
 * Limpia los punto y coma (;) del FINAL de línea de forma ultra segura.
 * NUNCA toca los punto y coma intermedios (ej: "const a = 1; break").
 */
function removeSemicolons(content) {
    const lines = content.split('\n');
    const result = [];

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // 1. No tocar líneas de bucles 'for (...; ...; ...)'
        if (/\bfor\s*\(/.test(line)) {
            result.push(line);
            continue;
        }

        // 2. Buscar la siguiente línea no vacía para verificar riesgos ASI
        let nextLine = '';
        for (let j = i + 1; j < lines.length; j++) {
            const trimmed = lines[j].trim();
            if (trimmed.length > 0) {
                nextLine = trimmed;
                break;
            }
        }

        // Si la siguiente línea empieza con caracteres peligrosos ASI, PRESERVAR el ';'
        const isASIHazard = /^[\(\[\`\+\-\/\*]/.test(nextLine);

        if (!isASIHazard) {
            // SOLO remover el ';' al FINAL absoluto de la línea.
            // Si la línea tiene "const a = 'x'; break;", solo quita el último ';', dejando "const a = 'x'; break"
            line = line.replace(/;\s*$/, '');
        }

        result.push(line);
    }

    return result.join('\n');
}

/**
 * Actualiza las referencias de importación en el contenido de un archivo
 */
function updateImportReferences(content) {
    let updatedContent = content;
    for (const [oldName, newName] of Object.entries(LIBRARY_RENAME_MAP)) {
        if (oldName === newName) continue;

        const oldBase = oldName.replace(/\.js$/, '');
        const newBase = newName.replace(/\.js$/, '');

        // Reemplazo exacto con .js
        const regexWithExt = new RegExp(`(['"/\\\\])${oldName}(['"])`, 'g');
        updatedContent = updatedContent.replace(regexWithExt, `$1${newName}$2`);

        // Reemplazo sin .js
        const regexNoExt = new RegExp(`(['"/\\\\])${oldBase}(['"])`, 'g');
        updatedContent = updatedContent.replace(regexNoExt, `$1${newBase}$2`);
    }
    return updatedContent;
}

/**
 * Renombra los archivos físicos en core/library
 */
function renameLibraryFiles() {
    console.log('\n📁 Renombrando archivos en core/library/...\n');
    if (!fs.existsSync(LIB_DIR)) {
        console.log('⚠️ La carpeta core/library no existe.');
        return;
    }

    for (const [oldName, newName] of Object.entries(LIBRARY_RENAME_MAP)) {
        if (oldName === newName) continue;
        const oldPath = path.join(LIB_DIR, oldName);
        const newPath = path.join(LIB_DIR, newName);

        if (fs.existsSync(oldPath)) {
            fs.renameSync(oldPath, newPath);
            console.log(`  ✓ Renombrado: ${oldName} ➔ ${newName}`);
        }
    }
}

/**
 * Procesa todos los archivos del proyecto
 */
function processProjectFiles() {
    console.log('\n🧹 Limpiando (;) de forma segura y actualizando importaciones globalmente...\n');
    const files = getAllJSFiles(ROOT_DIR);
    let modifiedCount = 0;

    for (const filePath of files) {
        const relativePath = path.relative(ROOT_DIR, filePath);
        let content = fs.readFileSync(filePath, 'utf8');
        const originalContent = content;

        // 1. Limpiar punto y coma del final de línea de forma segura
        content = removeSemicolons(content);

        // 2. Actualizar importaciones
        content = updateImportReferences(content);

        if (content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`  ✓ Procesado: ${relativePath}`);
            modifiedCount++;
        }
    }

    console.log(`\n🎉 ¡Listo! Se procesaron ${modifiedCount} archivo(s) sin romper sintaxis.\n`);
}

// Ejecución principal
try {
    renameLibraryFiles();
    processProjectFiles();
} catch (error) {
    console.error('❌ Error durante la ejecución del script:', error);
}