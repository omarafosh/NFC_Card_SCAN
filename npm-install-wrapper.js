const { execSync } = require('child_process');
const args = process.argv.slice(2).join(' ');
try {
    execSync(`npm install ${args}`, { stdio: 'inherit', shell: true });
} catch (e) {
    console.error('Install failed:', e.message);
    process.exit(1);
}
