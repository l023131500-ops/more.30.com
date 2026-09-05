# -*- coding: utf-8 -*-
"""חילוץ רשומות שיעור מייצוא טופס נדרים פלוס 4320 לקובץ JSON."""
import zipfile, sys, json, re
from xml.etree import ElementTree as ET

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
COL = lambda ref: ''.join(c for c in ref if c.isalpha())

def cells(row):
    out = {}
    for c in row.findall('m:c', NS):
        v = c.find('m:v', NS)
        if v is None or v.text is None:
            continue
        out[COL(c.get('r'))] = v.text.strip()
    return out

def multi(val):
    if not val:
        return []
    return [p.strip().lstrip('*').strip() for p in val.split(',') if p.strip().lstrip('*').strip()]

DAY_INDEX = {
    'יום ראשון': 0, 'יום שני': 1, 'יום שלישי': 2, 'יום רביעי': 3,
    'יום חמישי': 4, 'יום שישי': 5, 'ליל שבת': 5, 'שבת': 6, 'מוצאי שבת': 6,
}

def parse(path):
    root = ET.fromstring(zipfile.ZipFile(path).read('xl/worksheets/sheet1.xml'))
    rows = root.findall('.//m:sheetData/m:row', NS)
    records = []
    for row in rows[3:]:
        d = cells(row)
        if not d:
            continue
        times = [d[c] for c in ('AC','AD','AE','AF','AG','AH','AI','AJ','AK') if d.get(c)]
        days = multi(d.get('AL'))
        occurrences = []
        kind = d.get('Z') or 'שיעור קבוע'
        if kind == 'שיעור בתאריך מסוים':
            occurrences.append({'date': d.get('AA'), 'time': d.get('AB') or (times[0] if times else None)})
        else:
            for i, day in enumerate(days):
                occurrences.append({
                    'day': day,
                    'weekday': DAY_INDEX.get(day),
                    'time': times[i] if i < len(times) else (times[0] if times else None),
                })
        records.append({
            'external_id': d.get('A'),
            'topics': multi(d.get('I')),
            'audience_gender': d.get('O'),
            'audience_styles': multi(d.get('Q')),
            'language': d.get('R'),
            'lesson_style': d.get('S'),
            'venue_name': d.get('T'),
            'teacher_name': d.get('U'),
            'city': d.get('V'),
            'neighborhood': d.get('W'),
            'street': d.get('X'),
            'house_no': d.get('Y'),
            'schedule_kind': 'onetime' if kind == 'שיעור בתאריך מסוים' else 'recurring',
            'occurrences': occurrences,
            'broadcast_raw': d.get('AM'),
            'detail': d.get('AN'),
            'update_note': d.get('AO'),
            'contact_name': d.get('AP'),
            'contact_phone': d.get('AQ'),
            'contact_email': d.get('AR'),
            'organization': d.get('AS'),
        })
    return records

if __name__ == '__main__':
    print(json.dumps(parse(sys.argv[1]), ensure_ascii=False, indent=1))
