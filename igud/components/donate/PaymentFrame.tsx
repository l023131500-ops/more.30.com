'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * דף התשלום של נדרים פלוס, בתוך העמוד.
 *
 * נדרים פלוס אינם מקבלים פרמטרים בכתובת של האייפרם אלא בהודעת
 * postMessage אחרי שהוא נטען, ומדווחים חזרה באותה דרך. שלושת הסוגים
 * שמגיעים מהם הם Height לגובה המסגרת, TransactionResponse לתוצאת
 * העסקה, ו-Error לשגיאה.
 *
 * שתי החלטות שנובעות מכך שמדובר בכסף:
 *
 *   פרטי הכרטיס לעולם אינם עוברים דרכנו. הם מוקלדים בתוך המסגרת של
 *   נדרים פלוס ונשלחים ישירות אליהם. לכן אין כאן שדה כרטיס, אין
 *   ולידציה עליו, ואין מה לדלוף מכאן.
 *
 *   הודעות מתקבלות רק מהמקור של נדרים פלוס. בלי הבדיקה הזו כל דף
 *   שהצליח לפתוח אלינו חלון יכול היה לשלוח "העסקה אושרה".
 */

const ORIGIN = 'https://matara.pro';
const SRC = `${ORIGIN}/nedarimplus/iframe/`;

export interface PaymentConfig {
  mosadId: string;
  apiValid: string;
}

type Status = 'idle' | 'ready' | 'paid' | 'failed';

export default function PaymentFrame({
  config, amount, kind, donor, onDone,
}: {
  config: PaymentConfig;
  /** סכום בשקלים */
  amount: number;
  /** Ragil לתרומה חד פעמית, HK להוראת קבע */
  kind: 'Ragil' | 'HK';
  donor: { name: string; phone: string; email: string; comment?: string };
  onDone?: (ok: boolean, detail: string) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(500);
  const [status, setStatus] = useState<Status>('idle');
  const [detail, setDetail] = useState('');

  const post = useCallback((name: string, value: unknown) => {
    frame.current?.contentWindow?.postMessage({ Name: name, Value: value }, ORIGIN);
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // רק נדרים פלוס. בלי זה כל דף יכול להכריז שהעסקה אושרה
      if (event.origin !== ORIGIN) return;
      const data = event.data as { Name?: string; Value?: unknown };
      if (!data || typeof data.Name !== 'string') return;

      if (data.Name === 'Height') {
        const next = Number(data.Value);
        if (next > 0) setHeight(next + 24);
        return;
      }
      if (data.Name === 'TransactionResponse') {
        const value = String(data.Value ?? '');
        const ok = /ok/i.test(value);
        setStatus(ok ? 'paid' : 'failed');
        setDetail(value);
        onDone?.(ok, value);
        return;
      }
      if (data.Name === 'Error') {
        setStatus('failed');
        setDetail(String(data.Value ?? ''));
        onDone?.(false, String(data.Value ?? ''));
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onDone]);

  /** המסגרת נטענה ומוכנה לקבל את פרטי העסקה. */
  function onLoad() {
    setStatus('ready');
    post('GetHeight', null);
    post('SetTransaction', {
      Mosad: config.mosadId,
      ApiValid: config.apiValid,
      PaymentType: kind,
      Currency: '1',
      Zeout: '',
      FirstName: donor.name,
      LastName: '',
      Street: '',
      City: '',
      Phone: donor.phone,
      Mail: donor.email,
      Amount: String(amount),
      Tashlumim: kind === 'HK' ? '999' : '1',
      Groupe: '',
      Comment: donor.comment || 'תרומה לאיגוד השיעורים',
      Param1: 'igud',
      Param2: kind,
      CallBack: '',
      CallBackMailError: '',
      Language: 'he',
    });
  }

  if (status === 'paid') {
    return (
      <div className="rounded-2xl border border-green-600/40 bg-green-50 px-6 py-8 text-center">
        <p className="font-display text-2xl font-bold text-green-800">התרומה התקבלה</p>
        <p className="mt-2 text-[0.95rem] text-green-800">
          תבואו על הברכה. אישור נשלח אליכם במייל.
        </p>
      </div>
    );
  }

  return (
    <div>
      {status === 'failed' && (
        <p className="mb-3 rounded-xl border border-royal-300 bg-royal-50 px-4 py-3 text-sm font-bold text-royal-700">
          העסקה לא הושלמה{detail ? `: ${detail}` : ''}. אפשר לנסות שוב.
        </p>
      )}
      <iframe
        ref={frame}
        src={SRC}
        onLoad={onLoad}
        title="תשלום מאובטח בנדרים פלוס"
        className="w-full rounded-2xl border border-parch-300 bg-white"
        style={{ height }}
      />
    </div>
  );
}
