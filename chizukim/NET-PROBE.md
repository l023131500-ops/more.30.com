# NET-PROBE

בדיקת קישוריות בלבד (curl HTTP status code, timeout 15s).

## הפקודה

```bash
for h in www.call2all.co.il f2.freeivr.co.il csjekrvukbdznetsrodj.supabase.co drive.google.com; do echo "$h -> $(curl -sS -o /dev/null -w '%{http_code}' -m 15 https://$h/ 2>/dev/null)"; done
```

## הפלט המלא

```
www.call2all.co.il -> 000
f2.freeivr.co.il -> 000
csjekrvukbdznetsrodj.supabase.co -> 000
drive.google.com -> 000
```

סביבה: Default (trusted network access)
