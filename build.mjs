/**
 * build.mjs — יוצר גרסת קובץ יחיד (dist/index.html) שכוללת את כל הקוד והעיצוב.
 * שימושי להפצה במייל, לפתיחה מקומית ללא שרת, ולהטמעה בסביבות מוגבלות.
 * הרצה: node build.mjs
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);

// סדר טעינה לפי תלויות
const MODULES = [
  'src/hebcal.js',
  'src/store.js',
  'src/xlsx.js',
  'src/holidays.js',
  'src/ui.js',
  'src/yemot.js',
  'src/views/customers.js',
  'src/views/campaigns.js',
  'src/views/calendar.js',
  'src/views/past.js',
  'src/views/reports.js',
  'src/views/sale.js',
  'src/views/settings.js',
  'src/app.js',
];

const keyOf = (file) => file.replace(/^src\//, '').replace(/\.js$/, '');

function resolveSpec(fromFile, spec) {
  const abs = path.normalize(path.join(path.dirname(fromFile), spec));
  return keyOf(abs.replace(/\\/g, '/'));
}

function transform(file, code) {
  const exported = new Set();

  // import * as ns from '...'
  code = code.replace(/^import\s+\*\s+as\s+([\w$]+)\s+from\s+['"]([^'"]+)['"];?\s*$/gm,
    (_, ns, spec) => `const ${ns} = __M[${JSON.stringify(resolveSpec(file, spec))}];`);

  // import { a, b as c } from '...'
  code = code.replace(/^import\s*\{([\s\S]*?)\}\s*from\s+['"]([^'"]+)['"];?\s*$/gm,
    (_, names, spec) => {
      const parts = names.split(',').map((s) => s.trim()).filter(Boolean)
        .map((s) => {
          const m = /^([\w$]+)\s+as\s+([\w$]+)$/.exec(s);
          return m ? `${m[1]}: ${m[2]}` : s;
        });
      return `const { ${parts.join(', ')} } = __M[${JSON.stringify(resolveSpec(file, spec))}];`;
    });

  // export function / const / let / class
  code = code.replace(/^export\s+(async\s+)?function\s+([\w$]+)/gm, (_, a, n) => {
    exported.add(n); return `${a || ''}function ${n}`;
  });
  code = code.replace(/^export\s+(const|let|var)\s+([\w$]+)/gm, (_, kw, n) => {
    exported.add(n); return `${kw} ${n}`;
  });
  code = code.replace(/^export\s+class\s+([\w$]+)/gm, (_, n) => { exported.add(n); return `class ${n}`; });

  // export { a, b as c };
  code = code.replace(/^export\s*\{([^}]*)\};?\s*$/gm, (_, names) => {
    const parts = [];
    for (const raw of names.split(',').map((s) => s.trim()).filter(Boolean)) {
      const m = /^([\w$]+)\s+as\s+([\w$]+)$/.exec(raw);
      if (m) { exported.add(m[2]); parts.push(`${m[2]}: ${m[1]}`); }
      else exported.add(raw);
    }
    return '';
  });

  const key = keyOf(file);
  return `__M[${JSON.stringify(key)}] = (function () {\n${code}\nreturn { ${[...exported].join(', ')} };\n})();`;
}

const css = fs.readFileSync(path.join(ROOT, 'assets/styles.css'), 'utf8');
const bundle = MODULES.map((f) =>
  transform(f, fs.readFileSync(path.join(ROOT, f), 'utf8'))).join('\n\n');

const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>אופטיקה לכל כיס — ניהול מכירות</title>
<meta name="description" content="מערכת ניהול מכירות משקפיים בשכונות — לוח שנה עברי־לועזי, ניהול מכירה, לקוחות, רווחיות, דוחות וצינתוקים.">
<meta name="theme-color" content="#1e4e8c">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>👓</text></svg>">
<style>
${css}
</style>
</head>
<body>
<noscript><div style="padding:40px;text-align:center">יש להפעיל JavaScript כדי להשתמש במערכת.</div></noscript>
<script>
(function () {
"use strict";
const __M = {};
${bundle}
})();
</script>
</body>
</html>
`;

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/index.html'), html);
console.log('dist/index.html  ' + (html.length / 1024).toFixed(1) + ' KB');
