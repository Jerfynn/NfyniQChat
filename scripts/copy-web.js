// Copies the phone app from the desktop project (../nfyniq/mobile + assets) into www/
const fs = require('fs');
const path = require('path');
const src = path.resolve(__dirname, '..', 'web');
const dst = path.resolve(__dirname, '..', 'www');
fs.rmSync(dst, { recursive: true, force: true });
fs.cpSync(src, dst, { recursive: true });
console.log('web app copied to www/');
