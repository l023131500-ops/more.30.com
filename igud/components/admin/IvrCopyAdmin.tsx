'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { browserClient } from '@/lib/supabase';
import { COPY_ENTRIES, type CopyEntry } from '@/lib/ivr-copy';
import { Panel, Toast } from './ui';

/**
 * ניהול הנוסחים של המערכת הקולית.
 *
 * לכל משפט שנשמע בקו יש כאן שדה. השדה מראה את הנוסח שבתוקף, ולידו
 * נכתב מתי הוא נשמע — במילים של מי שעורך, לא של מי שמתכנת.
 *
 * שתי החלטות שמעצבות את המסך:
 *
 *   שדה שלא נגעו בו אינו נשמר. הטבלה מכילה רק את מה שנערך בפועל, ולכן
 *   אפשר תמיד לראות מה שונה מברירת המחדל, ואפשר להחזיר שורה למקור
 *   במחיקה אחת. מסך שהיה שומר את כל 120 השורות בכל שמירה היה מאבד את
 *   ההבחנה הזו.
 *
 *   שינוי בנוסח נכנס לתוקף בשיחה הבאה, בלי פריסה. היוצא מן הכלל הוא
 *   התפריט הראשי, שיושב פיזית בקובץ בימות המשיח ולא אצלנו, ולכן הוא
 *   דורש לחיצה על "בניית השלוחות" כדי לעבור לשם. המסך אומר את זה
 *   במפורש במקום שבו זה רלוונטי, כדי שאיש לא יתקן מילה ויתפלא למה
 *   הקו ממשיך לומר את הישן.
 */

interface Saved { key: string; text: string }

export default function IvrCopyAdmin() {
  const supabase = useMemo(() => browserClient(), []);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [tone, setTone] = useState<'ok' | 'error'>('ok');
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('igud_ivr_copy').select('key, text');
    const map: Record<string, string> = {};
    for (const row of (data || []) as Saved[]) {
      if (row.text) map[row.key] = row.text;
    }
    setEdited(map);
    setDraft({});
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => {
    const out = new Map<string, CopyEntry[]>();
    for (const entry of COPY_ENTRIES) {
      const list = out.get(entry.group) || [];
      list.push(entry);
      out.set(entry.group, list);
    }
    return [...out.entries()];
  }, []);

  const current = (entry: CopyEntry) =>
    draft[entry.key] ?? edited[entry.key] ?? entry.text;

  const changed = Object.keys(draft).filter(
    (key) => draft[key] !== (edited[key] ?? COPY_ENTRIES.find((e) => e.key === key)?.text ?? ''),
  );

  async function save() {
    if (!changed.length) return;
    setBusy(true);
    setToast('');

    const rows = changed.map((key) => ({ key, text: draft[key].trim() }));
    // נוסח שחזר בדיוק לברירת המחדל נמחק מהטבלה, כדי שהרשימה תישאר
    // רשימה של מה שנערך ולא ערימה של כפילויות
    const toDelete = rows
      .filter((row) => row.text === COPY_ENTRIES.find((e) => e.key === row.key)?.text)
      .map((row) => row.key);
    const toUpsert = rows.filter((row) => row.text && !toDelete.includes(row.key));

    let failed = '';
    if (toUpsert.length) {
      const { error } = await supabase.from('igud_ivr_copy').upsert(toUpsert);
      if (error) failed = error.message;
    }
    if (!failed && toDelete.length) {
      const { error } = await supabase.from('igud_ivr_copy').delete().in('key', toDelete);
      if (error) failed = error.message;
    }

    setBusy(false);
    setTone(failed ? 'error' : 'ok');
    setToast(failed || `נשמרו ${changed.length} נוסחים. השינוי נכנס לתוקף בשיחה הבאה`);
    if (!failed) await load();
  }

  function reset(key: string) {
    const fallback = COPY_ENTRIES.find((e) => e.key === key)?.text ?? '';
    setDraft((d) => ({ ...d, [key]: fallback }));
  }

  return (
    <Panel
      title="נוסחי המערכת הקולית"
      description="כל משפט שנשמע בקו. שינוי נכנס לתוקף בשיחה הבאה, בלי פריסה"
      actions={(
        <button
          type="button"
          onClick={save}
          disabled={busy || !changed.length}
          className="btn-primary disabled:opacity-40"
        >
          {busy ? 'שומר' : `שמירה${changed.length ? ` (${changed.length})` : ''}`}
        </button>
      )}
    >
      <Toast message={toast} tone={tone} />

      <p className="mb-4 mt-2 rounded-xl border border-parch-300 bg-parch-50 px-4 py-3 text-[0.82rem] leading-relaxed text-ink-700">
        הנקודה בטקסט אינה סימן פיסוק אלא מפרידה בין הודעה להודעה, וכל משפט נשמע בנפרד
        עם נשימה קצרה ביניהם. מקפים וגרשיים מוסרים אוטומטית לפני ההשמעה, כי יש להם
        משמעות בפרוטוקול. מה שכתוב בסוגריים מסולסלים הוא ערך שמשתנה לפי השיחה.
      </p>

      <div className="space-y-3">
        {groups.map(([group, entries]) => {
          const isOpen = open === group;
          const dirty = entries.filter((e) => changed.includes(e.key)).length;
          const custom = entries.filter((e) => edited[e.key] !== undefined).length;
          return (
            <section key={group} className="rounded-xl border border-parch-300">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : group)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right"
              >
                <span className="font-bold text-royal-700">{group}</span>
                <span className="text-[0.75rem] text-ink-500">
                  {dirty ? `${dirty} לא נשמרו · ` : ''}
                  {custom ? `${custom} נערכו · ` : ''}
                  {entries.length} הודעות
                </span>
              </button>

              {isOpen && (
                <div className="space-y-4 border-t border-parch-200 px-4 py-4">
                  {group === 'תפריט ראשי' && (
                    <p className="rounded-lg border border-royal-300 bg-royal-50 px-3 py-2 text-[0.78rem] leading-relaxed text-royal-700">
                      התפריט הראשי יושב בקובץ בימות המשיח ולא אצלנו. אחרי שמירה כאן יש
                      ללחוץ על <strong>בניית השלוחות</strong> במסך ההגדרות, כדי שהנוסח
                      החדש ייכתב לשם.
                    </p>
                  )}

                  {entries.map((entry) => {
                    const value = current(entry);
                    const isCustom = edited[entry.key] !== undefined;
                    const isDirty = changed.includes(entry.key);
                    return (
                      <div key={entry.key}>
                        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                          <label className="field-label mb-0">{entry.note}</label>
                          <span className="flex items-center gap-2 text-[0.7rem] text-ink-500">
                            {entry.vars?.length ? (
                              <span dir="ltr">{entry.vars.map((v) => `{${v}}`).join(' ')}</span>
                            ) : null}
                            {isDirty && <span className="text-royal-700">לא נשמר</span>}
                            {isCustom && !isDirty && <span>נערך</span>}
                            {(isCustom || isDirty) && (
                              <button
                                type="button"
                                onClick={() => reset(entry.key)}
                                className="underline"
                              >
                                החזרה למקור
                              </button>
                            )}
                          </span>
                        </div>
                        <textarea
                          value={value}
                          rows={value.length > 80 ? 3 : 2}
                          onChange={(e) => setDraft((d) => ({ ...d, [entry.key]: e.target.value }))}
                          className="field w-full"
                        />
                        <p className="mt-1 text-[0.68rem] text-ink-400" dir="ltr">{entry.key}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </Panel>
  );
}
