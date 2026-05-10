import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const tsPath = path.join(root, 'frontend/components/map/kakao-map-inline-html.ts');
const outPath = path.join(root, 'map-site/kakao.html');

const s = fs.readFileSync(tsPath, 'utf8');
const m = s.match(/return `([\s\S]*)`;/);
if (!m) throw new Error('template not found');
let html = m[1].replace(/\$\{kakaoJavascriptKey\}/g, '%KAKAO_JS_KEY%');
html = html.replace('<html>', '<html lang="ko">');
html = html.replace('<head>', '<head>\n    <meta charset="utf-8" />');

fs.writeFileSync(outPath, html, 'utf8');
console.log('wrote', outPath);
