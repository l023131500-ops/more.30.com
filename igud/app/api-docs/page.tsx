import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE } from '@/lib/site';
import { IconArrowLeft, IconGlobe, IconLink, IconPhone } from '@/components/Icons';

export const metadata: Metadata = {
  title: 'תיעוד ממשק API',
  description: 'תיעוד הממשק הציבורי של איגוד השיעורים, כתובת ה-callback לנדרים פלוס וחיבור המערכת הקולית.',
};

function Code({ children }: { children: string }) {
  return (
    <pre
      dir="ltr"
      className="overflow-x-auto rounded-xl border border-parch-300 bg-[#2A1512] px-4 py-3
                 text-[0.78rem] leading-relaxed text-gold-200"
    >
      <code>{children}</code>
    </pre>
  );
}

function Endpoint({ method, path, children }: { method: string; path: string; children?: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-royal-700 px-2 py-0.5 font-mono text-[0.72rem] font-bold text-gold-200">
          {method}
        </span>
        <code dir="ltr" className="text-[0.85rem] font-bold text-royal-700">{path}</code>
      </p>
      {children && <div className="mt-1.5 text-[0.88rem] leading-relaxed text-ink-700">{children}</div>}
    </div>
  );
}

function Section({ id, title, lead, children }: {
  id: string; title: string; lead?: string; children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-display text-2xl font-bold text-royal-700">{title}</h2>
      {lead && <p className="mt-1.5 text-[0.92rem] leading-relaxed text-ink-700">{lead}</p>}
      <div className="mt-4 space-y-4">{children}</div>
      <div className="rule-gold my-10 opacity-60" />
    </section>
  );
}

const TOC = [
  { id: 'public', label: 'ממשק ציבורי לקריאה' },
  { id: 'nedarim-in', label: 'callback בזמן אמת' },
  { id: 'nedarim-out', label: 'משיכת רשומות' },
  { id: 'yemot', label: 'המערכת הקולית' },
  { id: 'voice-agent', label: 'הסוכן הקולי' },
  { id: 'excel', label: 'ייבוא וייצוא אקסל' },
];

export default function ApiDocsPage() {
  const base = SITE.url;

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-10 sm:px-6">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-bold text-ink-500 transition hover:text-royal-600"
      >
        <IconArrowLeft className="h-4 w-4" />
        חזרה למאגר
      </Link>

      <header>
        <p className="flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-wide text-gold-700">
          <IconGlobe className="h-3.5 w-3.5" />
          למפתחים ולמערכות מקושרות
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold text-royal-700 sm:text-4xl">
          תיעוד ממשק API
        </h1>
        <p className="mt-2 max-w-2xl text-[0.95rem] leading-relaxed text-ink-700">
          כל הכתובות יחסיות לכתובת הבסיס של האתר. הקריאה פתוחה וללא הרשאה,
          ומחזירה רק שיעורים שאושרו לפרסום. הכתיבה מוגנת בסוד או בהרשאת מנהל.
        </p>
      </header>

      <nav className="my-8 flex flex-wrap gap-2">
        {TOC.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="rounded-full border border-parch-300 bg-white/70 px-3.5 py-1.5 text-[0.8rem] font-bold text-royal-700 transition hover:border-gold-400"
          >
            {item.label}
          </a>
        ))}
      </nav>

      <div className="rule-gold mb-10" />

      <Section
        id="public"
        title="ממשק ציבורי לקריאה"
        lead="שלוש כתובות פתוחות, מחזירות JSON עם כותרת CORS פתוחה. אפשר לשלב אותן באתר, בלוח דיגיטלי או באפליקציה."
      >
        <Endpoint method="GET" path="/api/public/lessons">
          רשימת שיעורים, ממוינת לפי המועד הקרוב. פרמטרים אפשריים:{' '}
          <code dir="ltr">q, city, topic, gender, language, style, day, broadcast, teacher, venue, page, limit</code>
        </Endpoint>
        <Code>{`curl "${base}/api/public/lessons?city=ירושלים&topic=דף יומי&limit=20"`}</Code>

        <Endpoint method="GET" path="/api/public/upcoming">
          המועדים הקרובים ביותר, שורה לכל מועד ולא לכל שיעור. פרמטר <code dir="ltr">limit</code>.
        </Endpoint>

        <Endpoint method="GET" path="/api/public/taxonomy">
          כל רשימות הבחירה של הטפסים: נושאים, קהלי יעד, שפות, סגנונות, ימים ועוד.
        </Endpoint>

        <Endpoint method="GET" path="/api/ics/{id}">
          קובץ יומן של שיעור, כולל חזרתיות שבועית, לייבוא ליומן הטלפון.
        </Endpoint>

        <Code>{`{
  "source": "איגוד השיעורים",
  "total": 128,
  "lessons": [
    {
      "id": "…",
      "title": "דף יומי",
      "teacher": "הרב נפתלי רבינוביץ",
      "venue": "בית הכנסת בוגרי הישיבות",
      "city": "פתח תקווה",
      "schedule": [{ "day": "יום ראשון", "time": "19:30:00" }],
      "next_at": "2026-09-06T16:30:00Z",
      "broadcast": "live",
      "url": "${base}/lesson/…"
    }
  ]
}`}</Code>
      </Section>

      <Section
        id="nedarim-in"
        title="קליטת טפסים מנדרים פלוס"
        lead="כתובת אחת שמקבלת את כל ארבעת הטפסים. כל רשומה נכנסת לתור האישור, ומתפרסמת רק אחרי בדיקה."
      >
        <Endpoint method="POST" path="/api/nedarim/callback">
          זו הכתובת שיש למסור לנדרים פלוס. הסוד נקבע במסך הניהול, בלשונית
          {' '}<Link href="/admin" className="font-bold text-royal-600 underline underline-offset-2">חיבורים והגדרות</Link>,
          ונשלח בכותרת <code dir="ltr">x-igud-secret</code> או בשדה <code dir="ltr">secret</code>.
        </Endpoint>

        <Code>{`POST ${base}/api/nedarim/callback
Content-Type: application/json
x-igud-secret: <הסוד ממסך הניהול>

{
  "FormId": "4320",
  "Data": {
    "RabbiName": "הרב ישראל כהן",
    "Location": "בית הכנסת אור החיים",
    "City": "ירושלים",
    "neighborhood": "הר נוף",
    "Street": "הרב שך",
    "Num": "12",
    "Topic_Dt": "*דף יומי, *הלכה בעיון",
    "GivingLessonGender": "גברים",
    "language": "עברית",
    "LessonStyle": "ליטאי",
    "LessonUpdate": "שיעור קבוע",
    "Day1": "true", "time1": "20:30",
    "Day2": "true", "time2": "20:30",
    "lessonDelivere": "שידור חי",
    "Name": "יעקב", "Tel": "0500000000", "Mail": "a@b.com"
  }
}`}</Code>

        <p className="text-[0.88rem] leading-relaxed text-ink-700">
          מספרי הטפסים הנתמכים: <strong>4320</strong> שיעור לפרסום, <strong>4063</strong> בקשה
          למגיד שיעור, <strong>4018</strong> רישום מגיד שיעור, <strong>4357</strong> הרשמה
          לעדכונים. שמות השדות זהים לשמות בטפסי נדרים פלוס, כולל תיבות הימים
          <code dir="ltr"> Day1</code> עד <code dir="ltr">Day9</code> והשעות{' '}
          <code dir="ltr">time1</code> עד <code dir="ltr">time9</code>.
        </p>

        <Endpoint method="GET" path="/api/nedarim/callback?ping=1">
          בדיקת חיים. מחזירה אישור בלי לכתוב נתונים.
        </Endpoint>
      </Section>

      <Section
        id="nedarim-out"
        title="משיכת רשומות מנדרים פלוס"
        lead="הדרך הרשמית לקלוט את מה שמולא בטפסים. דורשת הרשאת מנהל, ואפשר להריץ אותה גם כמשימה מתוזמנת."
      >
        <Endpoint method="POST" path="/api/nedarim/pull">
          פונה אל נדרים פלוס ומושך את הרשומות שנוספו מאז הסנכרון הקודם.
          בלי גוף — מסנכרן את כל הטפסים הפעילים.
        </Endpoint>
        <Code>{`{ "form": "4320", "reset": false }`}</Code>

        <p className="text-[0.88rem] leading-relaxed text-ink-700">
          מאחורי הקלעים נשלחת פנייה אל{' '}
          <code dir="ltr">Forms/Manage.aspx</code> עם{' '}
          <code dir="ltr">Action=GetJson</code>, מספר המוסד ומפתח ה-API
          (<code dir="ltr">ApiPassword</code>, מתחיל ב-<code dir="ltr">npk_</code>).
          המשיכה מתקדמת בסמן <code dir="ltr">LastId</code>, ולכן כל סנכרון מביא
          רק את החדש. רשומה שכבר נקלטה מתעדכנת ואינה נכפלת.
        </p>

        <Endpoint method="POST" path="/api/nedarim/probe">
          בדיקת שדות: מושכת רשומה אחת ומציגה מה מכיל כל{' '}
          <code dir="ltr">FieldN</code>, כדי לאמת את המספור לפני סנכרון מלא.
          קוראת בלבד ואינה כותבת למסד.
        </Endpoint>
      </Section>

      <Section
        id="yemot"
        title="חיבור המערכת הקולית"
        lead="חמש שלוחות, אחת אחרי השנייה. אחרי שמירת מפתח ה-API אפשר לבנות את כולן בלחיצה אחת ממסך הניהול."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-right text-[0.88rem]">
            <thead>
              <tr className="border-b border-parch-300 text-[0.78rem] text-ink-500">
                <th className="py-2 pl-4 font-bold">שלוחה</th>
                <th className="py-2 pl-4 font-bold">תפקיד</th>
                <th className="py-2 font-bold">כתובת</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-parch-200">
              {[
                ['1', 'חיפוש שיעור בדיבור חופשי, עם צמצום לפי עיר', '/api/yemot/search'],
                ['2', 'עדכון שיעור קיים, לפי מספר הטלפון של המתקשר', '/api/yemot/update'],
                ['3', 'הצטרפות כמגיד שיעור', '/api/yemot/maggid'],
                ['4', 'פתיחת שיעור תורה חדש', '/api/yemot/host'],
                ['5', 'שותפות בפעילות', '/api/yemot/partner'],
                ['6', 'מענה אנושי והשארת הודעה', '/api/yemot/contact'],
              ].map(([ext, role, path]) => (
                <tr key={ext}>
                  <td className="py-2.5 pl-4 font-display text-lg font-bold text-gold-700">{ext}</td>
                  <td className="py-2.5 pl-4 text-ink-700">{role}</td>
                  <td className="py-2.5"><code dir="ltr" className="text-[0.8rem] text-royal-700">{path}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mt-6 font-display text-lg font-bold text-royal-700">איך מחברים</h3>
        <ol className="mr-5 list-decimal space-y-2 text-[0.9rem] leading-relaxed text-ink-700">
          <li>נכנסים למסך הניהול, לשונית חיבורים והגדרות.</li>
          <li>ממלאים את מספר המערכת בימות המשיח, ואת מפתח ה-API או סיסמת המערכת.</li>
          <li>קובעים את שלוחת הבסיס. כל הכתיבה מוגבלת לשלוחה הזו בלבד, ואין שום פעולת מחיקה.</li>
          <li>לוחצים על <strong>בניית השלוחות</strong>. המערכת יוצרת תפריט ראשי ושש שלוחות API.</li>
          <li>מתקשרים לקו ובודקים.</li>
        </ol>

        <p className="rounded-xl border border-parch-300 bg-parch-50 px-4 py-3 text-[0.85rem] leading-relaxed text-ink-700">
          נוסח ההודעות אינו נערך בימות המשיח. קובץ ה-<code dir="ltr">ext.ini</code> הוא ארבע
          שורות שמצביעות על כתובת כאן, וכל התסריט, התפריטים והחיפוש רצים בשרת. שינוי בטקסט
          שנשמע למתקשר הוא שינוי בקוד, ולא בממשק של ימות.
        </p>

        <p className="text-[0.88rem] leading-relaxed text-ink-700">
          לבנייה ידנית, זה תוכן ה-<code dir="ltr">ext.ini</code> של שלוחת API:
        </p>
        <Code>{`type=api
api_url=${base}/api/yemot/search
api_url_post_data=ApiCallId,ApiPhone,ApiExtension,ApiDID,ApiEnterID
api_max_call_length=600`}</Code>

        <p className="text-[0.88rem] leading-relaxed text-ink-700">
          התשובה שהשרת מחזיר היא טקסט בפרוטוקול של ימות, לדוגמה:
        </p>
        <Code>{`id_list_message=t-חיפוש שיעור תורה&read=t-לחיפוש לפי עיר הקישו 1=mode,3,1,1,7,number,no,no,no,,,no`}</Code>

        <p className="rounded-xl border border-gold-400 bg-gold-50 px-4 py-3 text-[0.85rem] leading-relaxed text-ink-700">
          סדר הפרמטרים של הפקודה <code dir="ltr">read</code> משתנה מעט בין גרסאות של ימות
          המשיח. ברירות המחדל כאן מתאימות לגרסה הנפוצה, ואם ההקלדה אינה נקלטת נכון
          יש להתאים אותן בקובץ <code dir="ltr">lib/yemot.ts</code>, בפונקציה{' '}
          <code dir="ltr">read</code>.
        </p>
      </Section>

      <Section
        id="voice-agent"
        title="הסוכן הקולי"
        lead="שלוחה שמקבלת משפט חופשי, מפרשת אותו ומקריאה את השיעורים המתאימים."
      >
        <Endpoint method="POST" path="/api/yemot/agent">
          מקבלת את הטקסט המזוהה בפרמטר <code dir="ltr">text</code> (או{' '}
          <code dir="ltr">speech</code>), ומחזירה הקראה של עד חמישה שיעורים.
        </Endpoint>
        <Code>{`curl -X POST "${base}/api/yemot/agent" \\
  -d "text=דף יומי בבני ברק אחרי מעריב"`}</Code>
        <p className="text-[0.88rem] leading-relaxed text-ink-700">
          אם הוגדר מפתח של Claude במסך ההגדרות, הפירוש נעשה בעזרתו ומזהה עיר,
          נושא ושם רב מתוך המשפט. בלי מפתח, הסוכן נופל לחיפוש לפי מילות מפתח
          ועדיין עובד.
        </p>
      </Section>

      <Section
        id="excel"
        title="ייבוא וייצוא אקסל"
        lead="קבצי הייצוא של טפסי נדרים פלוס נקלטים ישירות ממסך הניהול, בלי המרה ידנית."
      >
        <ol className="mr-5 list-decimal space-y-2 text-[0.9rem] leading-relaxed text-ink-700">
          <li>מייצאים מנדרים פלוס את רשומות הטופס לקובץ xlsx.</li>
          <li>נכנסים למסך הניהול, לשונית ייבוא וייצוא, ובוחרים את הקובץ.</li>
          <li>המערכת מזהה לבד את מספר הטופס ומציגה כמה רשומות נמצאו.</li>
          <li>אפשר לייבא הכול לתור האישור, או לפרסם מיד רשומות שעברו בדיקת איכות.</li>
        </ol>
        <p className="text-[0.88rem] leading-relaxed text-ink-700">
          הייצוא לאקסל זמין באותה לשונית: כל השיעורים, בקשות לפתיחת שיעור,
          רישום מגידי שיעור ורשימת הנרשמים.
        </p>
      </Section>

      <footer className="rounded-2xl border border-parch-300 bg-white/60 p-6">
        <p className="flex items-center gap-2 text-[0.9rem] text-ink-700">
          <IconLink className="h-4 w-4 text-gold-600" />
          כתובת הבסיס של האתר: <code dir="ltr" className="font-bold text-royal-700">{base}</code>
        </p>
        <p className="mt-2 flex items-center gap-2 text-[0.9rem] text-ink-700">
          <IconPhone className="h-4 w-4 text-gold-600" />
          לשאלות טכניות: {SITE.email}
        </p>
      </footer>
    </div>
  );
}
