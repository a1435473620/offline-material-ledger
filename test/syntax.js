/* 语法检查：解析每个源文件与最终产物，不执行 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const out = [];

function check(label, src) {
  try { new Function(src); out.push('OK    ' + label); return true; }
  catch (e) { out.push('FAIL  ' + label + '\n      ' + e.message); return false; }
}

['core.js', 'ui.js', 'build.js'].forEach(f => {
  check('src/' + f, fs.readFileSync(path.join(root, 'src', f), 'utf8'));
});

// 检查产物：拆出每段 <script> 单独校验
const html = fs.readFileSync(path.join(root, '物料借还管理.html'), 'utf8');
const parts = html.split(/<script>/i).slice(1).map(s => s.split(/<\/script>/i)[0]);
parts.forEach((s, i) => check('产物 第' + (i + 1) + '段 script (' + s.length + ' 字符)', s));

// 检查 HTML 基本结构
out.push('');
out.push('包含 </html>      : ' + /<\/html>\s*$/i.test(html));
out.push('包含 id="app"     : ' + /id="app"/.test(html));
out.push('包含 id="toasts"  : ' + /id="toasts"/.test(html));   // v2 起 toast 容器是 #toasts
out.push('未替换的占位符    : ' + /\/\*__(CSS|CORE|UI)__\*\//.test(html));
out.push('产物体积          : ' + (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1) + ' KB');

fs.writeFileSync(path.join(__dirname, 'syntax.txt'), out.join('\n'), 'utf8');
