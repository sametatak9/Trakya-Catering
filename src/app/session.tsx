import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { clearUserState } from '@/lib/queryClient';
import type { AppRole } from '@/lib/domain';

export interface Member { userId: string; email: string; fullName: string; role: AppRole; customerId: string | null }

export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'pending'; email: string }       // giriş yaptı ama rol atanmadı / pasif
  | { status: 'ready'; member: Member };

const Ctx = createContext<SessionState>({ status: 'loading' });

async function loadMember(session: Session): Promise<SessionState> {
  const { data, error } = await supabase
    .from('team_members')
    .select('user_id, full_name, role, customer_id, active')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (error) throw error;
  const email = session.user.email ?? '';
  if (!data || !data.active) return { status: 'pending', email };
  return {
    status: 'ready',
    member: { userId: data.user_id, email, fullName: data.full_name || email, role: data.role as AppRole, customerId: data.customer_id },
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    const apply = (session: Session | null) => {
      if (!session) { if (alive) setState({ status: 'signedOut' }); return; }
      loadMember(session)
        .then((s) => { if (alive) setState(s); })
        .catch(() => { if (alive) setState({ status: 'pending', email: session.user.email ?? '' }); });
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Token yenilemede üyeliği tekrar okumaya gerek yok
      if (event === 'TOKEN_REFRESHED') return;
      if (event === 'SIGNED_OUT') clearUserState();
      // onAuthStateChange içinde doğrudan await yapılmaz (supabase-js kilidi); bir sonraki tick'e bırak
      setTimeout(() => apply(session), 0);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function useSessionState() { return useContext(Ctx); }

/** Yalnızca 'ready' durumundaki ekranlarda kullanılır. */
export function useMember(): Member {
  const s = useContext(Ctx);
  if (s.status !== 'ready') throw new Error('Oturum hazır değil');
  return s.member;
}

export function useCan(roles: AppRole[]): boolean {
  const s = useContext(Ctx);
  // Kurucu her yetkiye sahiptir (veritabanında has_role ile aynı kural)
  return s.status === 'ready' && (s.member.role === 'kurucu' || roles.includes(s.member.role));
}

export async function signOut() {
  await supabase.auth.signOut();
  clearUserState();
}
