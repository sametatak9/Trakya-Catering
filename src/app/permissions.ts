import { useMemo } from 'react';
import { useRows } from '@/lib/crud';
import { visibleModules, type PermissionMaps } from './modules';
import { useMember } from './session';

/** Kurucunun belirlediği görünürlük (rol × sekme, kişiye özel istisna) */
export function usePermissionMaps(): PermissionMaps {
  const me = useMember();
  const role = useRows('role_permissions', { key: ['all'] });
  const member = useRows('member_permissions', { key: [me.userId], filter: (q) => q.eq('user_id', me.userId) });
  return useMemo(() => ({
    role: new Map((role.data ?? []).map((r) => [`${r.role}|${r.module}`, r.level])),
    member: new Map((member.data ?? []).map((r) => [r.module, r.level])),
  }), [role.data, member.data]);
}

export function useVisibleModules() {
  const me = useMember();
  const perms = usePermissionMaps();
  return useMemo(() => visibleModules(me.role, perms), [me.role, perms]);
}
