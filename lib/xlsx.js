/**
 * xlsx.js — כתיבה וקריאה של קבצי Excel (.xlsx) ללא ספריות חיצוניות.
 * כתיבה: בניית ZIP (Store, ללא דחיסה) עם OOXML ו-inlineStr, כולל RTL.
 * קריאה: פריסת ZIP + ניפוח deflate דרך DecompressionStream, ופרסור XML.
 * בנוסף: ייצוא/ייבוא CSV עם BOM לתאימות Excel בעברית.
 */

/* =============================== CRC32 =============================== */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const enc = new TextEncoder();

/* ============================ ZIP (כתיבה) ============================ */

function zipStore(files) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 0x0800, true);   // UTF-8
    dv.setUint16(8, 0, true);        // store
    dv.setUint16(10, 0, true);
    dv.setUint16(12, 0x21, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, f.data.length, true);
    dv.setUint32(22, f.data.length, true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    chunks.push(local, f.data);

    const cen = new Uint8Array(46 + nameBytes.length);
    const cdv = new DataView(cen.buffer);
    cdv.setUint32(0, 0x02014b50, true);
    cdv.setUint16(4, 20, true);
    cdv.setUint16(6, 20, true);
    cdv.setUint16(8, 0x0800, true);
    cdv.setUint16(10, 0, true);
    cdv.setUint16(12, 0, true);
    cdv.setUint16(14, 0x21, true);
    cdv.setUint32(16, crc, true);
    cdv.setUint32(20, f.data.length, true);
    cdv.setUint32(24, f.data.length, true);
    cdv.setUint16(28, nameBytes.length, true);
    cdv.setUint32(42, offset, true);
    cen.set(nameBytes, 46);
    central.push(cen);

    offset += local.length + f.data.length;
  }

  const centralSize = central.reduce((a, c) => a + c.length, 0);
  const end = new Uint8Array(22);
  const edv = new DataView(end.buffer);
  edv.setUint32(0, 0x06054b50, true);
  edv.setUint16(8, files.length, true);
  edv.setUint16(10, files.length, true);
  edv.setUint32(12, centralSize, true);
  edv.setUint32(16, offset, true);

  return new Blob([...chunks, ...central, end], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/* ============================ בניית XLSX ============================ */

const CTRL_RE = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]', 'g');

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(CTRL_RE, '');

function colName(n) {
  let s = '';
  n++;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

// מחרוזת עם אפס מוביל (טלפון/ת.ז.) נשמרת כטקסט כדי לא לאבד את האפס
const isNumeric = (v) => {
  if (typeof v === 'number') return isFinite(v);
  if (typeof v !== 'string') return false;
  const t = v.trim();
  if (t === '' || !/^-?\d+(\.\d+)?$/.test(t)) return false;
  if (/^0\d/.test(t)) return false;
  return t.replace('-', '').replace('.', '').length <= 15;
};

/**
 * יוצר Blob של xlsx.
 * sheets: [{ name, rows: [[cell,...]], rtl?, colWidths?:[] }]
 */
export function buildXlsx(sheets) {
  const sheetXmls = sheets.map((sheet, si) => {
    const rows = sheet.rows || [];
    let maxCols = 0;
    for (const r of rows) maxCols = Math.max(maxCols, r.length);
    const cols = (sheet.colWidths && sheet.colWidths.length)
      ? '<cols>' + sheet.colWidths.map((w, i) =>
          `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols>'
      : '';
    const body = rows.map((row, ri) => {
      const cells = row.map((v, ci) => {
        const ref = colName(ci) + (ri + 1);
        const style = ri === 0 ? ' s="1"' : '';
        if (v === null || v === undefined || v === '') return `<c r="${ref}"${style}/>`;
        if (typeof v === 'boolean') return `<c r="${ref}"${style} t="b"><v>${v ? 1 : 0}</v></c>`;
        if (isNumeric(v)) return `<c r="${ref}"${style}><v>${Number(v)}</v></c>`;
        return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
      }).join('');
      return `<row r="${ri + 1}">${cells}</row>`;
    }).join('');
    const dim = rows.length ? `A1:${colName(Math.max(0, maxCols - 1))}${rows.length}` : 'A1';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="${dim}"/>
<sheetViews><sheetView rightToLeft="${sheet.rtl === false ? 0 : 1}" workbookViewId="0"${si === 0 ? ' tabSelected="1"' : ''}><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
${cols}
<sheetData>${body}</sheetData>
</worksheet>`;
  });

  const safeName = (n, i) =>
    esc(String(n || 'גיליון' + (i + 1)).slice(0, 31).replace(/[\\\/\?\*\[\]:]/g, '-'));

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheets.map((s, i) =>
    `<sheet name="${safeName(s.name, i)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>`;

  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1E4E8C"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>
</styleSheet>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const files = [
    { name: '[Content_Types].xml', data: enc.encode(contentTypes) },
    { name: '_rels/.rels', data: enc.encode(rels) },
    { name: 'xl/workbook.xml', data: enc.encode(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(wbRels) },
    { name: 'xl/styles.xml', data: enc.encode(styles) },
    ...sheetXmls.map((x, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(x) })),
  ];
  return zipStore(files);
}

/* ============================ קריאת XLSX ============================ */

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('הדפדפן אינו תומך בפריסת קבצי xlsx — יש לייבא כקובץ CSV');
  }
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzip(buffer) {
  const bytes = new Uint8Array(buffer);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('הקובץ אינו ZIP/XLSX תקין');
  const count = dv.getUint16(eocd + 10, true);
  let ptr = dv.getUint32(eocd + 16, true);
  const out = {};
  const dec = new TextDecoder('utf-8');

  for (let i = 0; i < count; i++) {
    if (dv.getUint32(ptr, true) !== 0x02014b50) break;
    const method = dv.getUint16(ptr + 10, true);
    const compSize = dv.getUint32(ptr + 20, true);
    const nameLen = dv.getUint16(ptr + 28, true);
    const extraLen = dv.getUint16(ptr + 30, true);
    const commentLen = dv.getUint16(ptr + 32, true);
    const localOff = dv.getUint32(ptr + 42, true);
    const name = dec.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));

    const lNameLen = dv.getUint16(localOff + 26, true);
    const lExtraLen = dv.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = bytes.subarray(dataStart, dataStart + compSize);
    out[name] = method === 0 ? raw : await inflateRaw(raw);
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function refToCol(ref) {
  const m = /^([A-Z]+)/.exec(ref);
  if (!m) return 0;
  let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** קורא xlsx ומחזיר [{name, rows}] */
export async function readXlsx(file) {
  const buf = await file.arrayBuffer();
  const zip = await unzip(buf);
  const dec = new TextDecoder('utf-8');
  const parser = new DOMParser();

  let shared = [];
  if (zip['xl/sharedStrings.xml']) {
    const doc = parser.parseFromString(dec.decode(zip['xl/sharedStrings.xml']), 'application/xml');
    shared = Array.from(doc.getElementsByTagName('si')).map((si) =>
      Array.from(si.getElementsByTagName('t')).map((t) => t.textContent).join(''));
  }

  let names = [];
  if (zip['xl/workbook.xml']) {
    const doc = parser.parseFromString(dec.decode(zip['xl/workbook.xml']), 'application/xml');
    names = Array.from(doc.getElementsByTagName('sheet')).map((s) => s.getAttribute('name'));
  }

  const sheetFiles = Object.keys(zip)
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
    .sort((a, b) => (+a.match(/\d+/)[0]) - (+b.match(/\d+/)[0]));

  const sheets = [];
  for (let i = 0; i < sheetFiles.length; i++) {
    const doc = parser.parseFromString(dec.decode(zip[sheetFiles[i]]), 'application/xml');
    const rows = [];
    for (const rowEl of Array.from(doc.getElementsByTagName('row'))) {
      const rIdx = parseInt(rowEl.getAttribute('r') || String(rows.length + 1), 10) - 1;
      const arr = [];
      for (const c of Array.from(rowEl.getElementsByTagName('c'))) {
        const ci = refToCol(c.getAttribute('r') || '');
        const t = c.getAttribute('t');
        let val = '';
        if (t === 'inlineStr') {
          val = Array.from(c.getElementsByTagName('t')).map((x) => x.textContent).join('');
        } else {
          const v = c.getElementsByTagName('v')[0];
          const raw = v ? v.textContent : '';
          if (t === 's') val = shared[parseInt(raw, 10)] || '';
          else if (t === 'b') val = raw === '1';
          else val = raw;
        }
        arr[ci] = val;
      }
      for (let k = 0; k < arr.length; k++) if (arr[k] === undefined) arr[k] = '';
      rows[rIdx] = arr;
    }
    for (let k = 0; k < rows.length; k++) if (!rows[k]) rows[k] = [];
    sheets.push({ name: names[i] || ('גיליון ' + (i + 1)), rows });
  }
  return sheets;
}

/* ================================ CSV ================================ */

export function toCsv(rows, delimiter = ',') {
  return rows.map((r) => r.map((v) => {
    const s = String(v == null ? '' : v);
    return /[",\n\r\t;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(delimiter)).join('\r\n');
}

export function parseCsv(text) {
  const s = text.replace(/^﻿/, '');
  const firstLine = s.split(/\r?\n/)[0] || '';
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let inQ = false;
  for (const ch of firstLine) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ && ch in counts) counts[ch]++;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const delim = best[1] > 0 ? best[0] : ',';

  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch === '\r') { /* ignore */ }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/* ============================== הורדות ============================== */

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadXlsx(sheets, filename) {
  downloadBlob(buildXlsx(sheets), filename.endsWith('.xlsx') ? filename : filename + '.xlsx');
}

export function downloadCsv(rows, filename) {
  const blob = new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename.endsWith('.csv') ? filename : filename + '.csv');
}

/** קורא קובץ נתונים (xlsx/csv) ומחזיר גיליונות אחידים */
export async function readTableFile(file) {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) return await readXlsx(file);
  const text = await file.text();
  return [{ name: file.name, rows: parseCsv(text) }];
}
