const fs = require('fs');
const path = require('path');

function removeCommentsFromFile(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        const ext = path.extname(filePath);
        
        if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
            content = content
                .replace(/\/\*\*\s*@format\s*\*\//g, '')
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\/\/.*/g, '')
                .replace(/^\s*[\r\n]/gm, (match, offset, string) => {
                    const lines = string.substring(0, offset).split('\n');
                    const prevLine = lines[lines.length - 1] || '';
                    if (prevLine.trim() === '') {
                        return match;
                    }
                    return '';
                });
            
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✓ Processed: ${filePath}`);
        } else if (['.yml', '.yaml', '.conf'].includes(ext) || filePath.includes('nginx.conf')) {
            content = content.replace(/#.*/g, '');
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✓ Processed: ${filePath}`);
        } else if (ext === '.css') {
            content = content.replace(/\/\*[\s\S]*?\*\//g, '');
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✓ Processed: ${filePath}`);
        }
    } catch (error) {
        console.error(`✗ Error processing ${filePath}:`, error.message);
    }
}

function processDirectory(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
            if (!['node_modules', '.next', '.git', 'dist'].includes(entry.name)) {
                processDirectory(fullPath);
            }
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            const validExts = ['.js', '.jsx', '.ts', '.tsx', '.yml', '.yaml', '.css', '.conf'];
            const validFiles = ['nginx.conf', '.gitignore', '.env'];
            
            if (validExts.includes(ext) || validFiles.includes(entry.name)) {
                if (!entry.name.includes('.config.') && !entry.name.endsWith('.mjs')) {
                    removeCommentsFromFile(fullPath);
                }
            }
        }
    }
}

const projectRoot = '/Users/ahmed/Desktop/dockerv';
console.log('Starting comment removal...\n');
processDirectory(projectRoot);
console.log('\n✓ Comment removal complete!');
