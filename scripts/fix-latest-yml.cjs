const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '..', 'dist-release-final');
const ymlPath = path.join(outputDir, 'latest.yml');

if (!fs.existsSync(ymlPath)) {
    console.log('[fix-latest-yml] latest.yml not found, skipping');
    process.exit(0);
}

let content = fs.readFileSync(ymlPath, 'utf-8');

if (content.includes('blockMapSize')) {
    console.log('[fix-latest-yml] blockMapSize already exists, skipping');
    process.exit(0);
}

const lines = content.split('\n');
const newLines = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    newLines.push(line);

    if (line.includes('url:') && line.includes('.exe')) {
        const urlMatch = line.match(/url:\s*(.+\.exe)/);
        if (urlMatch) {
            const exeName = urlMatch[1].trim();
            const blockmapName = exeName + '.blockmap';
            const blockmapPath = path.join(outputDir, blockmapName);

            if (fs.existsSync(blockmapPath)) {
                const stat = fs.statSync(blockmapPath);
                const nextLine = lines[i + 1] || '';
                if (nextLine.includes('size:')) {
                    newLines.push(nextLine);
                    newLines.push(`    blockMapSize: ${stat.size}`);
                    i++;
                    console.log('[fix-latest-yml] Added blockMapSize:', stat.size, 'for', exeName);
                } else {
                    newLines.push(`    blockMapSize: ${stat.size}`);
                    console.log('[fix-latest-yml] Added blockMapSize:', stat.size, 'for', exeName);
                }
            } else {
                console.log('[fix-latest-yml] blockmap file not found:', blockmapName);
            }
        }
    }
}

fs.writeFileSync(ymlPath, newLines.join('\n'), 'utf-8');
console.log('[fix-latest-yml] latest.yml fixed');
