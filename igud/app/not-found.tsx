import Link from 'next/link';
import Image from 'next/image';
import { SITE } from '@/lib/site';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <Image
        src={SITE.markSmall}
        alt=""
        width={96}
        height={96}
        className="h-20 w-20 opacity-90"
      />
      <h1 className="mt-6 font-display text-2xl font-bold text-royal-700">הדף לא נמצא</h1>
      <p className="mt-2 text-sm text-ink-500">
        ייתכן שהשיעור הוסר מהמאגר, או שהקישור אינו מדויק.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className="btn btn-primary">חזרה למאגר</Link>
        <Link href="/search" className="btn btn-quiet">חיפוש שיעור</Link>
      </div>
    </div>
  );
}
