// Пересобирает списки «## Разделы» и «## Заметки» во всех оглавлениях 02_База
// по фактическому содержимому папок. Остальной текст оглавления не трогает.
// Оглавление — заметка с тем же именем, что и папка (Работа/Работа.md). README.md в корне — карта блоков.
// Заодно добавляет таблицу «Где встречается» людям, местам, организациям и вещам, у которых её нет,
// и ставит `up` (родительское оглавление) заметкам, у которых его нет. У оглавлений блоков `up` нет — они верх.
// node 04_Система/скрипты/обновить-оглавления.js
const fs = require('fs');
const path = require('path');
const D = path.resolve(__dirname, '..', '..', '02_База');

const ENTITY_BASE = ['## Где встречается', '', '```base', 'filters:', '  and:', '    - file.hasLink(this.file)', '    - type != "оглавление"',
  'views:', '  - type: table', '    name: Ссылаются сюда', '    order:', '      - file.name', '      - type', '      - дата', '```', ''].join('\n');

const byName = (a, b) => a.localeCompare(b, 'ru', { numeric: true });
let indexes = 0, bases = 0, ups = 0;

function ensureUp(f, parent) {
  if (!parent) return;
  const t = fs.readFileSync(f, 'utf8');
  const fm = t.match(/^---\r?\n[\s\S]*?\r?\n---/);
  if (!fm || /^up:/m.test(fm[0])) return;
  const nl = t.includes('\r\n') ? '\r\n' : '\n';
  fs.writeFileSync(f, fm[0].replace(/\r?\n---$/, `${nl}up: "[[${parent}]]"${nl}---`) + t.slice(fm[0].length), 'utf8');
  ups++;
}

function walk(dir, parentIndex) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const subdirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort(byName);
  const notes = entries.filter(e => e.isFile() && e.name.endsWith('.md')).map(e => e.name.replace(/\.md$/, ''));
  const own = path.basename(dir);
  const indexName = dir === D ? null : own;
  const hasIndex = indexName && notes.includes(indexName);

  for (const n of notes) {
    if (n === indexName || (dir === D && n === 'README')) continue;
    const f = path.join(dir, n + '.md');
    if (hasIndex) ensureUp(f, indexName);
    const t = fs.readFileSync(f, 'utf8');
    const type = (t.match(/^type:\s*(.+)$/m) || [])[1];
    if (['человек', 'место', 'организация', 'вещь'].includes((type || '').trim()) && !/## Где встречается/.test(t)) {
      fs.writeFileSync(f, t.replace(/\s*$/, '\n\n') + ENTITY_BASE, 'utf8');
      bases++;
    }
  }

  if (hasIndex) {
    const f = path.join(dir, indexName + '.md');
    ensureUp(f, parentIndex);
    let t = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
    // вырезать старые списки
    t = t.replace(/\n## (Разделы|Заметки)\n[\s\S]*?(?=\n## |\s*$)/g, '');
    const list = [];
    const subIdx = subdirs.filter(s => fs.existsSync(path.join(dir, s, s + '.md')));
    if (subIdx.length) list.push('## Разделы', '', ...subIdx.map(s => `- [[${s}]]`), '');
    const own = notes.filter(n => n !== indexName).sort(byName);
    if (own.length) list.push('## Заметки', '', ...own.map(n => `- [[${n}]]`), '');
    const block = list.join('\n');
    const tableAt = t.search(/\n## (Таблица|Где встречается)\n/);
    t = tableAt >= 0 ? t.slice(0, tableAt).replace(/\s*$/, '\n\n') + block + t.slice(tableAt) : t.replace(/\s*$/, '\n\n') + block;
    fs.writeFileSync(f, t.replace(/\n{3,}/g, '\n\n').replace(/\s*$/, '\n'), 'utf8');
    indexes++;
  }
  for (const s of subdirs) walk(path.join(dir, s), hasIndex ? indexName : null);
}

walk(D, null);
console.log(`оглавлений обновлено: ${indexes}, таблиц «Где встречается» добавлено: ${bases}, up проставлено: ${ups}`);
