import { useEffect } from 'react';
import { supabaseConfigured } from '@/lib/supabase';
import { ComingSoon, DashboardPage } from '@/features/dashboard/DashboardPage';
import { IngredientsPage } from '@/features/kitchen/IngredientsPage';
import { MenusPage } from '@/features/kitchen/MenusPage';
import { RecipeEditor } from '@/features/kitchen/RecipeEditor';
import { RecipesPage } from '@/features/kitchen/RecipesPage';
import { TeamPage } from '@/features/team/TeamPage';
import { Loading } from '@/ui/primitives';
import { LoginScreen, PendingAccess, PortalComingSoon, SetupMissing } from './AuthScreens';
import { activeModule, visibleModules } from './modules';
import { matchPath, useRouter } from './router';
import { useMember, useSessionState } from './session';
import { Shell } from './Shell';
import { applyTheme, readTheme } from './theme';

function Routes() {
  const { path } = useRouter();
  const member = useMember();
  const mod = activeModule(path);

  if (!mod || !visibleModules(member.role).includes(mod)) {
    return <ComingSoon label="Sayfa bulunamadı" />;
  }
  if (mod.status === 'soon') return <ComingSoon label={mod.label} phase={mod.phase} />;

  const recipe = matchPath('/receteler/:id', path);
  if (recipe) return <RecipeEditor id={recipe.id === 'yeni' ? null : recipe.id} />;

  switch (mod.path) {
    case '/': return <DashboardPage />;
    case '/hammaddeler': return <IngredientsPage />;
    case '/receteler': return <RecipesPage />;
    case '/menuler': return <MenusPage />;
    case '/ekip': return <TeamPage />;
    default: return <ComingSoon label={mod.label} />;
  }
}

export function App() {
  const state = useSessionState();
  useEffect(() => { applyTheme(readTheme()); }, []);

  if (!supabaseConfigured) return <SetupMissing />;
  if (state.status === 'loading') return <div className="min-h-dvh grid place-items-center"><Loading label="Oturum açılıyor…" /></div>;
  if (state.status === 'signedOut') return <LoginScreen />;
  if (state.status === 'pending') return <PendingAccess email={state.email} />;
  if (state.member.role === 'musteri') return <PortalComingSoon />;
  return <Shell><Routes /></Shell>;
}
