'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useIgudSession } from '@/lib/auth';
import { loadTaxonomyClient } from '@/lib/taxonomy-client';
import type { Taxonomy } from '@/lib/types';
import { SITE } from '@/lib/site';
import LoginCard from '@/components/auth/LoginCard';
import OverviewAdmin from '@/components/admin/OverviewAdmin';
import LessonsAdmin from '@/components/admin/LessonsAdmin';
import PeopleAdmin from '@/components/admin/PeopleAdmin';
import RequestsAdmin from '@/components/admin/RequestsAdmin';
import ImportExport from '@/components/admin/ImportExport';
import TaxonomyAdmin from '@/components/admin/TaxonomyAdmin';
import SettingsAdmin from '@/components/admin/SettingsAdmin';
import SubscribersAdmin from '@/components/admin/SubscribersAdmin';
import DonationsAdmin from '@/components/admin/DonationsAdmin';
import { IconArrowLeft } from '@/components/Icons';

const SECTIONS = [
  { id: 'overview', label: 'סקירה' },
  { id: 'pending', label: 'ממתינים לאישור' },
  { id: 'lessons', label: 'כל השיעורים' },
  { id: 'teachers', label: 'מגידי שיעור' },
  { id: 'venues', label: 'מרכזי תורה' },
  { id: 'requests', label: 'בקשות לשיעור' },
  { id: 'maggidim', label: 'רישום מגידים' },
  { id: 'subscribers', label: 'נרשמים' },
  { id: 'donations', label: 'תרומות' },
  { id: 'import', label: 'ייבוא וייצוא' },
  { id: 'taxonomy', label: 'רשימות בחירה' },
  { id: 'settings', label: 'חיבורים והגדרות' },
];

export default function AdminPage() {
  const { session, me, loading, signIn, signOut } = useIgudSession();
  const [section, setSection] = useState('overview');
  const [taxonomy, setTaxonomy] = useState<Taxonomy>({});
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (session) void loadTaxonomyClient().then(setTaxonomy);
  }, [session]);

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-ink-500">טוען...</div>;
  }

  if (!session) {
    return (
      <LoginCard
        title="כניסת מנהל"
        subtitle="ניהול המאגר, אישור שיעורים, טפסים והגדרות המערכת."
        onSubmit={signIn}
      />
    );
  }

  if (!me?.is_admin) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="card-surface max-w-md rounded-2xl p-8 text-center">
          <h1 className="font-display text-xl font-bold text-royal-700">אין הרשאת ניהול</h1>
          <p className="mt-2 text-sm text-ink-500">
            החשבון הזה אינו מוגדר כמנהל המערכת.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Link href="/portal" className="btn btn-quiet">לאזור האישי</Link>
            <button type="button" onClick={signOut} className="btn btn-primary">יציאה</button>
          </div>
        </div>
      </div>
    );
  }

  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <div className="mx-auto max-w-[1300px] px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Image src="/brand/mark-96.webp" alt="" width={96} height={96} className="h-11 w-11" />
          <div>
            <h1 className="font-display text-xl font-bold text-royal-700">ניהול {SITE.name}</h1>
            <p className="text-[0.75rem] text-ink-500">{session.user.email}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/" className="btn btn-quiet !py-2 !text-[0.8rem]">
            <IconArrowLeft className="h-3.5 w-3.5" />
            לאתר
          </Link>
          <button type="button" onClick={signOut} className="btn btn-quiet !py-2 !text-[0.8rem]">
            יציאה
          </button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav className="lg:sticky lg:top-6 lg:self-start">
          <ul className="flex gap-1.5 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
            {SECTIONS.map((item) => (
              <li key={item.id} className="shrink-0 lg:shrink">
                <button
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`w-full whitespace-nowrap rounded-lg px-3.5 py-2 text-right text-[0.85rem] font-bold transition-colors ${
                    section === item.id
                      ? 'bg-gradient-to-l from-royal-600 to-royal-700 text-gold-100'
                      : 'text-ink-700 hover:bg-gold-50 hover:text-royal-700'
                  }`}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div key={`${section}-${refreshKey}`}>
          {section === 'overview' && <OverviewAdmin onJump={setSection} />}
          {section === 'pending' && <LessonsAdmin mode="pending" taxonomy={taxonomy} onChanged={bump} />}
          {section === 'lessons' && <LessonsAdmin mode="all" taxonomy={taxonomy} onChanged={bump} />}
          {section === 'teachers' && <PeopleAdmin kind="teacher" />}
          {section === 'venues' && <PeopleAdmin kind="venue" />}
          {section === 'requests' && <RequestsAdmin kind="open_lesson" />}
          {section === 'maggidim' && <RequestsAdmin kind="maggid" />}
          {section === 'subscribers' && <SubscribersAdmin />}
          {section === 'donations' && <DonationsAdmin />}
          {section === 'import' && <ImportExport />}
          {section === 'taxonomy' && <TaxonomyAdmin />}
          {section === 'settings' && <SettingsAdmin />}
        </div>
      </div>
    </div>
  );
}
