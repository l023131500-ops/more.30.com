'use client';

import { useEffect, useState } from 'react';
import { EXTENSIONS, apiExtensionIni, rootMenuIni } from '@/lib/yemot';
import { copyDefaults } from '@/lib/ivr-copy';
import { SITE } from '@/lib/site';
import { IconCheck, IconCopy } from '../Icons';
import { Panel } from './ui';

/**
 * תוכן קובצי השלוחות, להעתקה ידנית.
 *
 * הכפתור "בניית השלוחות" עושה את זה אוטומטית, אבל יש מצבים שבהם
 * עדיף או צריך ידנית: מפתח API בלי הרשאת כתיבה, מערכת שכבר יש בה
 * שלוחות ורוצים לשלב, או פשוט רצון לראות בדיוק מה נכתב לפני שכותבים.
 * המסך הזה נותן את התוכן המדויק, בדיוק כפי שהבנייה האוטומטית כותבת.
 */

function FileBlock({
  path, contents, title,
}: {
  path: string; contents: string; title: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(contents);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* מתעלמים */ }
  };

  return (
    <div className="rounded-xl border border-parch-200 bg-parch-50">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-parch-200 px-3 py-2">
        <div className="min-w-0">
          <p className="text-[0.86rem] font-semibold text-ink-800">{title}</p>
          <p dir="ltr" className="text-right font-mono text-[0.72rem] text-ink-500">{path}</p>
        </div>
        <button type="button" onClick={copy} className="btn btn-quiet shrink-0 !px-3 !py-1.5 !text-[0.76rem]">
          {copied
            ? <><IconCheck className="h-3.5 w-3.5 text-green-700" /> הועתק</>
            : <><IconCopy className="h-3.5 w-3.5" /> העתקה</>}
        </button>
      </div>
      <pre
        dir="ltr"
        className="max-h-56 overflow-auto px-3 py-2.5 text-right font-mono text-[0.72rem] leading-relaxed text-ink-700"
        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
      >
        {contents}
      </pre>
    </div>
  );
}

export default function YemotFiles({ rootExt }: { rootExt: string }) {
  const [origin, setOrigin] = useState(SITE.url);
  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin);
  }, []);

  const root = rootExt || '1';

  return (
    <Panel
      title="תוכן השלוחות להעתקה ידנית"
      description="בדיוק מה שהבנייה האוטומטית כותבת. מי שמעדיף להזין ידנית בממשק ימות המשיח, מעתיק מכאן."
    >
      <div className="mb-4 rounded-lg border border-parch-200 bg-white p-3 text-[0.82rem] leading-relaxed text-ink-600">
        <p className="mb-2 font-semibold text-ink-800">איך מזינים ידנית</p>
        <ol className="mr-4 list-decimal space-y-1">
          <li>נכנסים לניהול המערכת בימות המשיח, ללשונית ניהול הקבצים.</li>
          <li>
            יוצרים את התיקיות <span dir="ltr" className="font-mono">{root}</span> ותחתיה{' '}
            <span dir="ltr" className="font-mono">1</span> עד{' '}
            <span dir="ltr" className="font-mono">5</span>.
          </li>
          <li>
            בכל תיקייה יוצרים קובץ בשם <span dir="ltr" className="font-mono">ext.ini</span>,
            ומדביקים לתוכו את התוכן המתאים מלמטה.
          </li>
          <li>שומרים, ומתקשרים לקו לבדיקה.</li>
        </ol>
        <p className="mt-2 text-ink-500">
          התוכן כאן מצביע על <span dir="ltr" className="font-mono">{origin}</span> —
          הכתובת שממנה נפתח המסך הזה. אם תחליפו דומיין, יש לעדכן את הקבצים.
        </p>
      </div>

      <div className="space-y-3">
        <FileBlock
          title="תפריט ראשי"
          path={`ivr2:/${root}/ext.ini`}
          contents={rootMenuIni(copyDefaults)}
        />
        {EXTENSIONS.map((plan) => (
          <FileBlock
            key={plan.ext}
            title={`שלוחה ${plan.ext} — ${plan.title}`}
            path={`ivr2:/${root}/${plan.ext}/ext.ini`}
            contents={apiExtensionIni(origin, plan)}
          />
        ))}
      </div>
    </Panel>
  );
}
