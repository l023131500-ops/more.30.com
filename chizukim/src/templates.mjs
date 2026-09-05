// תבניות ה-ext.ini שנכתבות לכל שלוחה.
//
// ⚠️ הפורמט המדויק נבדק מול המערכת החיה בהרצת הטייס (`npm run pilot`)
// לפני ההעלאה המלאה. אם נדרש תיקון — משנים כאן בלבד, ולא בשאר הקוד.

/** שלוחת תפריט: המאזין מקיש ספרה ועובר לתת-שלוחה */
export function menuIni(label) {
  return [
    `# ${label}`,
    'type=menu',
    'timeout=7',
    'enable_keyboard=yes',
  ].join('\n') + '\n';
}

/** שלוחת השמעה: משמיעה את הקבצים שבתיקייה לפי סדרם */
export function playfileIni(label) {
  return [
    `# ${label}`,
    'type=playfile',
    'playfileListSort=name',
    'enable_keyboard=yes',
  ].join('\n') + '\n';
}
