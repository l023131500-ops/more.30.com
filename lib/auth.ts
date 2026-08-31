'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { browserClient } from './supabase';

export interface IgudAccount {
  role: 'admin' | 'teacher' | 'venue' | 'center';
  display_name: string | null;
  teacher_id: string | null;
  venue_id: string | null;
}

export interface IgudMe {
  user_id: string | null;
  is_admin: boolean;
  accounts: IgudAccount[];
}

/** שם משתמש שהוא מספר טלפון מתורגם לכתובת פנימית. */
export function loginToEmail(login: string): string {
  const value = login.trim().toLowerCase();
  if (/^0\d{8,9}$/.test(value.replace(/\D/g, '')) && !value.includes('@')) {
    return `${value.replace(/\D/g, '')}@igud.local`;
  }
  return value;
}

export function useIgudSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<IgudMe | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const client = browserClient();
    const { data } = await client.auth.getSession();
    setSession(data.session);
    if (data.session) {
      const { data: profile } = await client.rpc('igud_me');
      setMe((profile as IgudMe) || null);
    } else {
      setMe(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const { data: sub } = browserClient().auth.onAuthStateChange(() => { void refresh(); });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  const signIn = useCallback(async (login: string, password: string) => {
    const { error } = await browserClient().auth.signInWithPassword({
      email: loginToEmail(login),
      password,
    });
    if (error) {
      throw new Error(
        /invalid/i.test(error.message)
          ? 'שם המשתמש או הסיסמה אינם נכונים'
          : error.message,
      );
    }
    await refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await browserClient().auth.signOut();
    await refresh();
  }, [refresh]);

  return { session, me, loading, signIn, signOut, refresh };
}
