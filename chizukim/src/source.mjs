import { cfg } from './config.mjs';

const FIELDS = [
  'id', 'seq', 'topic', 'parsha_or_date', 'duration_seconds', 'audio_url',
  'original_name', 'subfolder', 'source', 'edited_transcript', 'raw_transcript',
].join(',');

/** שולף את כל ההקלטות החיות מהמסד של אתר החיזוקים, בעמודים. */
export async function fetchRecordings({ pageSize = 200, log = () => {} } = {}) {
  const out = [];
  for (let from = 0; ; from += pageSize) {
    const url = `${cfg.supabaseUrl()}/rest/v1/recordings`
      + `?select=${FIELDS}&deleted_at=is.null&order=seq.asc`;
    const res = await fetch(url, {
      headers: {
        apikey: cfg.supabaseKey(),
        Authorization: `Bearer ${cfg.supabaseKey()}`,
        Range: `${from}-${from + pageSize - 1}`,
      },
    });
    if (!res.ok) throw new Error(`שליפה מהמסד נכשלה: HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`);
    const rows = await res.json();
    out.push(...rows);
    log(`נשלפו ${out.length} רשומות`);
    if (rows.length < pageSize) break;
  }
  return out;
}

/** מוריד את קובץ השמע של הקלטה. */
export async function downloadAudio(row, { retries = 3 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 2000 * 2 ** (attempt - 1)));
    try {
      const res = await fetch(row.audio_url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      // גוגל דרייב מחזיר דף HTML כשהקובץ אינו ציבורי — שגיאה שקטה שחייבים לתפוס
      if (buf.length < 10_000 || buf.subarray(0, 200).toString('utf8').includes('<html')) {
        throw new Error(`התקבל תוכן שאינו שמע (${buf.length} בתים) — ייתכן שהקובץ אינו משותף`);
      }
      return buf;
    } catch (e) { lastErr = e; }
  }
  throw new Error(`הורדת ${row.audio_url} נכשלה — ${lastErr?.message}`);
}
