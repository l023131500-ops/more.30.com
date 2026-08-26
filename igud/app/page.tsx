import Image from 'next/image';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="grid items-center gap-8 sm:grid-cols-[1fr_auto]">
        <div>
          <h1 className="text-3xl leading-tight text-wine-800 sm:text-4xl">
            כל שיעורי התורה בארץ, במקום אחד
          </h1>
          <p className="mt-3 max-w-xl text-ink-soft">
            מוצאים שיעור ליד הבית, מוצאים מגיד שיעור לבית הכנסת, ומעדכנים שיעור שכבר קיים —
            הכול בלי טפסים ובלי טלפונים.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/search" className="btn btn-primary">
              חיפוש שיעור
            </Link>
            <Link href="/join" className="btn btn-secondary">
              מחפשים מגיד שיעור?
            </Link>
          </div>
        </div>
        <Image
          src="/logo-igud-320.png"
          alt="איגוד השיעורים"
          width={200}
          height={236}
          priority
          className="mx-auto hidden h-auto w-40 sm:block"
        />
      </section>

      <div className="rule-gold" />

      <section aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading" className="text-xl text-wine-800">
          השיעורים הקרובים
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          הטור מתמלא ברגע שממשק הקריאה מהמסד מחובר.
        </p>
      </section>
    </div>
  );
}
