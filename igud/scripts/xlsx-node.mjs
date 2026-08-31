/**
 * קריאת קובץ xlsx ב-Node ללא תלויות חיצוניות.
 * מפרק את ה-ZIP ידנית, מנפח את הזרמים עם zlib, ומפרסר את ה-XML בביטויים רגולריים
 * (מבנה גיליון של Excel קבוע דיו לשם כך).
 */

import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

function readUInt32(buf, off) { return buf.readUInt32LE(off); }
function readUInt16(buf, off) { return buf.readUInt16LE(off); }

/** מחזיר מפה של שם קובץ אל Buffer. */
export function unzip(buf) {
  // איתור ה-End Of Central Directory
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66_000; i -= 1) {
    if (readUInt32(buf, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('קובץ ZIP פגום: לא נמצא EOCD');

  const count = readUInt16(buf, eocd + 10);
  let ptr = readUInt32(buf, eocd + 16);
  const files = {};

  for (let n = 0; n < count; n += 1) {
    if (readUInt32(buf, ptr) !== 0x02014b50) break;
    const method = readUInt16(buf, ptr + 10);
    const compSize = readUInt32(buf, ptr + 20);
    const nameLen = readUInt16(buf, ptr + 28);
    const extraLen = readUInt16(buf, ptr + 30);
    const commentLen = readUInt16(buf, ptr + 32);
    const localOff = readUInt32(buf, ptr + 42);
    const name = buf.toString('utf8', ptr + 46, ptr + 46 + nameLen);

    const lhNameLen = readUInt16(buf, localOff + 26);
    const lhExtraLen = readUInt16(buf, localOff + 28);
    const dataStart = localOff + 30 + lhNameLen + lhExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);

    files[name] = method === 0 ? raw : inflateRawSync(raw);
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
};

function unescapeXml(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENTITIES[m]);
}

function textOf(xml) {
  const out = [];
  const re = /<t[^>]*>([\s\S]*?)<\/t>/g;
  let m;
  while ((m = re.exec(xml))) out.push(unescapeXml(m[1]));
  return out.join('');
}

function colIndex(ref) {
  const m = /^([A-Z]+)/.exec(ref || '');
  if (!m) return 0;
  let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** קורא xlsx ומחזיר [{ name, rows }] כאשר rows הוא מערך של מערכי מחרוזות. */
export function readXlsxFile(path) {
  const zip = unzip(readFileSync(path));

  let shared = [];
  if (zip['xl/sharedStrings.xml']) {
    const xml = zip['xl/sharedStrings.xml'].toString('utf8');
    shared = (xml.match(/<si>[\s\S]*?<\/si>/g) || []).map(textOf);
  }

  const names = [];
  if (zip['xl/workbook.xml']) {
    const xml = zip['xl/workbook.xml'].toString('utf8');
    const re = /<sheet[^>]*name="([^"]*)"/g;
    let m;
    while ((m = re.exec(xml))) names.push(unescapeXml(m[1]));
  }

  const sheetKeys = Object.keys(zip)
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

  return sheetKeys.map((key, i) => {
    const xml = zip[key].toString('utf8');
    const rows = [];
    const rowRe = /<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
    let rowMatch;
    while ((rowMatch = rowRe.exec(xml))) {
      const rowIndex = Number(rowMatch[1]) - 1;
      const cells = [];
      const cellRe = /<c([^>]*)\/>|<c([^>]*)>([\s\S]*?)<\/c>/g;
      let cellMatch;
      while ((cellMatch = cellRe.exec(rowMatch[2]))) {
        const attrs = cellMatch[1] || cellMatch[2] || '';
        const body = cellMatch[3] || '';
        const ref = (/r="([A-Z]+\d+)"/.exec(attrs) || [])[1] || '';
        const type = (/t="([^"]+)"/.exec(attrs) || [])[1] || '';
        let value = '';
        if (type === 'inlineStr') {
          value = textOf(body);
        } else {
          const v = /<v[^>]*>([\s\S]*?)<\/v>/.exec(body);
          const raw = v ? unescapeXml(v[1]) : '';
          value = type === 's' ? (shared[Number(raw)] ?? '') : raw;
        }
        cells[colIndex(ref)] = value;
      }
      for (let k = 0; k < cells.length; k += 1) if (cells[k] === undefined) cells[k] = '';
      rows[rowIndex] = cells;
    }
    for (let k = 0; k < rows.length; k += 1) if (!rows[k]) rows[k] = [];
    return { name: names[i] || `גיליון ${i + 1}`, rows };
  });
}
