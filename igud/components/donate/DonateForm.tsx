'use client';

import { useMemo, useState } from 'react';
import PaymentFrame, { type PaymentConfig } from './PaymentFrame';

/**
 * טופס התרומה לאיגוד.
 *
 * שני שלבים ולא אחד: קודם בוחרים סכום ומזדהים, ורק אז נפתחת מסגרת
 * התשלום. זה נראה כמו צעד מיותר אבל הוא חוסך את הטעות הנפוצה ביותר —
 * מסגרת סליקה שנטענת עם סכום אפס כי המבקר עדיין לא בחר.
 *
 * הסכומים המוצעים אינם אקראיים: 18 ומכפלותיו, כי כך נהוג לתרום.
 */

const AMOUNTS = [18, 36, 52, 100, 180, 360];

export default function DonateForm({ config }: { config: PaymentConfig }) {
  const [kind, setKind] = useState<'Ragil' | 'HK'>('Ragil');
  const [amount, setAmount] = useState(52);
  const [custom, setCustom] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [open, setOpen] = useState(false);

  const finalAmount = useMemo(() => {
    const parsed = Number(String(custom).replace(/\D/g, ''));
    return parsed > 0 ? parsed : amount;
  }, [custom, amount]);

  const canPay = finalAmount > 0 && name.trim().length > 1 && phone.replace(/\D/g, '').length >= 9;

  if (open) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-bold text-royal-700">
            {kind === 'HK' ? 'הוראת קבע' : 'תרומה חד פעמית'} · {finalAmount} שקלים
            {kind === 'HK' ? ' לחודש' : ''}
          </p>
          <button type="button" onClick={() => setOpen(false)} className="text-sm underline">
            שינוי הפרטים
          </button>
        </div>
        <PaymentFrame
          config={config}
          amount={finalAmount}
          kind={kind}
          donor={{ name: name.trim(), phone: phone.trim(), email: email.trim() }}
        />
        <p className="text-center text-[0.78rem] text-ink-500">
          פרטי הכרטיס נמסרים ישירות לנדרים פלוס ואינם עוברים דרך האתר שלנו
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2">
        {(['Ragil', 'HK'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setKind(option)}
            className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${
              kind === option
                ? 'border-royal-600 bg-royal-600 text-white'
                : 'border-parch-300 bg-white text-ink-700'
            }`}
          >
            {option === 'Ragil' ? 'תרומה חד פעמית' : 'הוראת קבע חודשית'}
          </button>
        ))}
      </div>

      <div>
        <label className="field-label">סכום התרומה</label>
        <div className="grid grid-cols-3 gap-2">
          {AMOUNTS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => { setAmount(value); setCustom(''); }}
              className={`rounded-xl border px-3 py-3 font-bold transition ${
                !custom && amount === value
                  ? 'border-royal-600 bg-royal-50 text-royal-700'
                  : 'border-parch-300 bg-white text-ink-700'
              }`}
            >
              {value}
            </button>
          ))}
        </div>
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          inputMode="numeric"
          placeholder="או סכום אחר"
          className="field mt-2 w-full"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label">שם מלא</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="field w-full" />
        </div>
        <div>
          <label className="field-label">טלפון</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            className="field w-full"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label">מייל, לקבלת אישור</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputMode="email"
            dir="ltr"
            className="field w-full"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!canPay}
        className="btn btn-primary w-full disabled:opacity-40"
      >
        {kind === 'HK'
          ? `להוראת קבע של ${finalAmount} שקלים לחודש`
          : `לתרומה של ${finalAmount} שקלים`}
      </button>
    </div>
  );
}
