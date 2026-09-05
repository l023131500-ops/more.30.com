/**
 * שלד טעינה.
 *
 * ב-Next.js, עמוד שמושך נתונים בשרת ואין לו loading משאיר את הדפדפן
 * על העמוד הישן עד שהתשובה חוזרת. המשתמש לוחץ, שום דבר לא זז, והוא
 * לוחץ שוב — וזו בדיוק התחושה של אתר תקוע. שלד שמופיע מיד הופך את
 * אותה שנייה בדיוק ממתח לציפייה.
 *
 * הצורות כאן מחקות את המבנה של מה שיגיע, ולא ריבועים אקראיים: מי
 * שרואה שלד של כרטיס שיעור כבר יודע מה עומד להופיע, והמעבר נראה כמו
 * המשך ולא כמו החלפה.
 */

export function Bar({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-parch-200 ${className}`} />;
}

/** כרטיס שיעור בטעינה */
export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-parch-200 bg-white/60 p-5">
      <div className="flex items-start gap-3">
        <Bar className="h-12 w-12 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Bar className="h-4 w-3/5" />
          <Bar className="h-3 w-2/5" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Bar className="h-3 w-full" />
        <Bar className="h-3 w-4/5" />
      </div>
      <div className="mt-4 flex gap-2">
        <Bar className="h-6 w-20 rounded-full" />
        <Bar className="h-6 w-16 rounded-full" />
      </div>
    </div>
  );
}

/** רשת כרטיסים, כמו לוח השיעורים */
export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6">
      <Bar className="h-8 w-56" />
      <Bar className="mt-3 h-4 w-80" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/** עמוד פריט בודד: כותרת, פרטים, ותוכן */
export function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-[1000px] px-4 py-10 sm:px-6">
      <Bar className="h-4 w-28" />
      <Bar className="mt-6 h-10 w-2/3" />
      <Bar className="mt-3 h-5 w-1/3" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-parch-200 bg-white/60 p-5">
            <Bar className="h-3 w-24" />
            <Bar className="mt-2.5 h-5 w-4/5" />
          </div>
        ))}
      </div>
      <div className="mt-8 space-y-2.5">
        <Bar className="h-3 w-full" />
        <Bar className="h-3 w-11/12" />
        <Bar className="h-3 w-3/4" />
      </div>
    </div>
  );
}

/** עמוד טופס */
export function FormSkeleton() {
  return (
    <div className="mx-auto max-w-[900px] px-4 py-10 sm:px-6">
      <Bar className="h-9 w-1/2" />
      <Bar className="mt-3 h-4 w-3/4" />
      <div className="mt-8 space-y-5 rounded-2xl border border-parch-200 bg-white/60 p-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i}>
            <Bar className="h-3 w-28" />
            <Bar className="mt-2 h-10 w-full" />
          </div>
        ))}
        <Bar className="h-11 w-40 rounded-xl" />
      </div>
    </div>
  );
}
