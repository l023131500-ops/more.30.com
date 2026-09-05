'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserClient } from '@/lib/supabase';
import { IconCheck, IconClose, IconPlus } from '../Icons';
import { ConfirmButton, EmptyState, Panel, Toast } from './ui';

interface TaxRow {
  id: string;
  kind: string;
  value: string;
  sort: number;
  active: boolean;
}

const KIND_LABELS: Record<string, string> = {
  topics: 'נושאי לימוד',
  audienceGender: 'למי מיועד השיעור',
  audienceStyles: 'סגנון קהל היעד',
  languages: 'שפות',
  lessonStyle: 'סגנון השיעור',
  lessonCharacter: 'אופי השיעור',
  speechStyle: 'סגנון דיבור',
  venueTypes: 'מקומות מסירה',
  venueKinds: 'סוגי מקום',
  days: 'ימים',
  timeSlots: 'חלקי היום',
  frequency: 'תדירות',
  broadcast: 'שידור והקלטה',
  rabbiBackground: 'רקע מגיד שיעור',
  rabbiExtraSkills: 'כישורים נוספים',
  maritalStatus: 'מצב אישי',
  occupation: 'עיסוק',
  travel: 'ניידות',
  travelRange: 'טווח נסיעה',
  rabbiPayExpectation: 'ציפיית תגמול',
  payerOffer: 'תשלום מוצע',
  requesterType: 'סוג המבקש',
  synagogueNusach: 'נוסח בית הכנסת',
  synagogueActivity: 'רמת פעילות',
  religiousServices: 'שירותי דת',
  familyStyle: 'סגנון משפחה',
  trainingYesNo: 'כן או לא',
  cities: 'ערים',
};

export default function TaxonomyAdmin() {
  const [rows, setRows] = useState<TaxRow[]>([]);
  const [kind, setKind] = useState('topics');
  const [newValue, setNewValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const { data, error: qError } = await browserClient()
        .from('igud_taxonomy')
        .select('id, kind, value, sort, active')
        .eq('kind', kind)
        .order('sort');
      if (qError) throw new Error(qError.message);
      setRows((data || []) as TaxRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'הטעינה נכשלה');
    } finally {
      setBusy(false);
    }
  }, [kind]);

  useEffect(() => { void load(); }, [load]);

  const flash = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 2400);
  };

  const add = async () => {
    const value = newValue.trim();
    if (!value) return;
    const sort = (rows.at(-1)?.sort || 0) + 10;
    const { error: insError } = await browserClient()
      .from('igud_taxonomy')
      .insert({ kind, value, sort, active: true });
    if (insError) { setError(insError.message); return; }
    setNewValue('');
    flash('הערך נוסף');
    await load();
  };

  const toggle = async (row: TaxRow) => {
    const { error: upError } = await browserClient()
      .from('igud_taxonomy')
      .update({ active: !row.active })
      .eq('id', row.id);
    if (upError) { setError(upError.message); return; }
    await load();
  };

  const rename = async (row: TaxRow, value: string) => {
    if (value.trim() === row.value || !value.trim()) return;
    const { error: upError } = await browserClient()
      .from('igud_taxonomy')
      .update({ value: value.trim() })
      .eq('id', row.id);
    if (upError) { setError(upError.message); return; }
    flash('הערך עודכן');
    await load();
  };

  const move = async (row: TaxRow, direction: -1 | 1) => {
    const index = rows.findIndex((r) => r.id === row.id);
    const other = rows[index + direction];
    if (!other) return;
    const client = browserClient();
    await client.from('igud_taxonomy').update({ sort: other.sort }).eq('id', row.id);
    await client.from('igud_taxonomy').update({ sort: row.sort }).eq('id', other.id);
    await load();
  };

  const remove = async (id: string) => {
    const { error: delError } = await browserClient().from('igud_taxonomy').delete().eq('id', id);
    if (delError) { setError(delError.message); return; }
    await load();
  };

  return (
    <Panel
      title="רשימות הבחירה"
      description="כל האפשרויות שמופיעות בטפסים ובסינונים. שינוי כאן משפיע מיד על כל האתר."
      actions={
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="field !w-auto !py-2 !text-[0.82rem]"
        >
          {Object.entries(KIND_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      }
    >
      <div className="space-y-3">
        {message && <Toast message={message} />}
        {error && <Toast message={error} tone="error" />}

        <div className="flex gap-2">
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void add(); }}
            placeholder={`הוספת ערך ל${KIND_LABELS[kind]}`}
            className="field !py-2 !text-[0.85rem]"
          />
          <button type="button" onClick={add} className="btn btn-primary shrink-0 !py-2 !text-[0.82rem]">
            <IconPlus className="h-3.5 w-3.5" />
            הוספה
          </button>
        </div>

        {busy && <p className="text-sm text-ink-500">טוען...</p>}
        {!busy && rows.length === 0 && <EmptyState text="אין ערכים ברשימה הזו." />}

        <ul className="space-y-1.5">
          {rows.map((row, i) => (
            <li
              key={row.id}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                row.active ? 'border-parch-300 bg-white/70' : 'border-parch-300 bg-parch-200 opacity-60'
              }`}
            >
              <span className="w-6 shrink-0 text-center text-[0.7rem] text-ink-500 tabular-nums">{i + 1}</span>
              <input
                defaultValue={row.value}
                onBlur={(e) => rename(row, e.target.value)}
                className="field !border-transparent !bg-transparent !py-1 !text-[0.88rem]"
              />
              <button
                type="button"
                onClick={() => move(row, -1)}
                disabled={i === 0}
                className="btn btn-quiet !px-2 !py-1 !text-[0.7rem] disabled:opacity-30"
                title="למעלה"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => move(row, 1)}
                disabled={i === rows.length - 1}
                className="btn btn-quiet !px-2 !py-1 !text-[0.7rem] disabled:opacity-30"
                title="למטה"
              >
                ▼
              </button>
              <button
                type="button"
                onClick={() => toggle(row)}
                className="btn btn-quiet !px-2 !py-1 !text-[0.7rem]"
                title={row.active ? 'הסתרה' : 'הפעלה'}
              >
                {row.active ? <IconCheck className="h-3 w-3" /> : <IconClose className="h-3 w-3" />}
              </button>
              <ConfirmButton
                label="מחיקה"
                confirmLabel="למחוק"
                onConfirm={() => remove(row.id)}
                className="btn btn-quiet !px-2 !py-1 !text-[0.7rem]"
              />
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
