import Image from 'next/image';
import type { ComponentType } from 'react';
import { photoOf, type SceneKey } from '@/lib/imagery';
import BeitMidrash from './art/BeitMidrash';
import AronKodesh from './art/AronKodesh';
import ArchBand from './art/ArchBand';

/**
 * רקע של אזור בעמוד.
 *
 * הרכיב מקבל שם משבצת ומחליט לבדו מה להציג: אם הוגדר צילום למשבצת
 * הזאת ב-lib/imagery — הצילום; ואם לא — האיור שנקבע לה. העמודים עצמם
 * אינם יודעים מה מהשניים הם מציגים, ולכן החלפה מצילום לאיור או להפך
 * אינה נוגעת בהם כלל.
 *
 * ה"overlay" אינו קישוט: על צילום, ובמידה פחותה על איור, טקסט לבן
 * הולך לאיבוד בכתמים הבהירים. השכבה הכהה מבטיחה שהמילים יישבו על
 * שקט בכל מקרה.
 */

const ART: Record<SceneKey, ComponentType<{ className?: string }>> = {
  hero: BeitMidrash,
  join: AronKodesh,
  cta: ArchBand,
  centers: ArchBand,
  rabbis: ArchBand,
  search: ArchBand,
};

interface Props {
  name: SceneKey;
  className?: string;
  /** עוצמת השכבה הכהה שמעל. 0 מבטל אותה */
  overlay?: string;
  /** הפתיח נטען ראשון, ולכן מבקש עדיפות */
  priority?: boolean;
}

export default function Scene({ name, className = '', overlay, priority = false }: Props) {
  const photo = photoOf(name);
  const Art = ART[name];

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {photo ? (
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          priority={priority}
          sizes="100vw"
          className="object-cover"
          style={photo.focus ? { objectPosition: photo.focus } : undefined}
        />
      ) : (
        <Art className="h-full w-full" />
      )}
      {overlay ? <div className={`absolute inset-0 ${overlay}`} /> : null}
    </div>
  );
}
