/* 把 core.js + ui.js + style.css 合并成单文件 HTML
 * 用法：node src/build.js
 */
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const root = path.join(dir, '..');

const css = fs.readFileSync(path.join(dir, 'style.css'), 'utf8');
const core = fs.readFileSync(path.join(dir, 'core.js'), 'utf8');
const ui = fs.readFileSync(path.join(dir, 'ui.js'), 'utf8');
const tpl = fs.readFileSync(path.join(dir, 'template.html'), 'utf8');

// 用函数形式替换，避免内容里的 $& / $1 被当成替换模式
let out = tpl
  .replace('/*__CSS__*/', () => css)
  .replace('/*__CORE__*/', () => core)
  .replace('/*__UI__*/', () => ui);

// 安全检查：合并后的脚本体内不能出现 </script>
const scripts = out.split('<script>').slice(1);
scripts.forEach((s, i) => {
  if (/<\/script>/i.test(s.split('</script>')[0])) {
    console.warn('警告：第 ' + (i + 1) + ' 段脚本内部含 </script>，会导致解析中断');
  }
});

const target = path.join(root, '物料借还管理.html');
fs.writeFileSync(target, out, 'utf8');

const kb = (Buffer.byteLength(out, 'utf8') / 1024).toFixed(1);
console.log('已生成：' + target);
console.log('体积：' + kb + ' KB');
console.log('校验：core=' + core.length + ' 字符, ui=' + ui.length + ' 字符, css=' + css.length + ' 字符');
