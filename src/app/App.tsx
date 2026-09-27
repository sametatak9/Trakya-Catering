import { useEffect } from 'react';
import { supabaseConfigured } from '@/lib/supabase';
import { NotFound } from '@/features/dashboard/DashboardPage';
import { HomePage } from '@/features/dashboard/Workspace';
import { CashPage } from '@/features/finance/CashPage';
import { ExpensesPage } from '@/features/finance/ExpensesPage';
import { FinanceSummaryPage } from '@/features/finance/FinanceSummaryPage';
import { InvoicesPage } from '@/features/finance/InvoicesPage';
import { FounderPage } from '@/features/founder/FounderPage';
import { AttendancePage } from '@/features/people/AttendancePage';
import { BalancesPage } from '@/features/people/BalancesPage';
import { PersonnelPage } from '@/features/people/PersonnelPage';
import { CardPage, OrderPortalPage } from '@/features/public/PublicPages';
import { PurchasingPage } from '@/features/stock/PurchasingPage';
import { StockPage } from '@/features/stock/StockPage';
import { SuppliersPage } from '@/features/stock/SuppliersPage';
import { SuppliesPage } from '@/features/stock/SuppliesPage';
import { KitchenScreen } from '@/features/production/KitchenScreen';
import { CalibrationPage } from '@/features/production/CalibrationPage';
import { MenuPlanPage } from '@/features/production/MenuPlanPage';
import { PrepPage } from '@/features/production/PrepPage';
import { ProductionOrderPage } from '@/features/production/ProductionOrderPage';
import { CustomersPage } from '@/features/sales/CustomersPage';
import { OrdersPage } from '@/features/sales/OrdersPage';
import { IngredientsPage } from '@/features/kitchen/IngredientsPage';
import { MenusPage } from '@/features/kitchen/MenusPage';
import { RecipeEditor } from '@/features/kitchen/RecipeEditor';
import { RecipesPage } from '@/features/kitchen/RecipesPage';
import { TeamPage } from '@/features/team/TeamPage';
import { Loading } from '@/ui/primitives';
import { LoginScreen, PendingAccess, PortalComingSoon, SetupMissing } from './AuthScreens';
import { resolveAlias, resolveRoute } from './modules';
import { ModuleTabs } from './ModuleTabs';
import { usePermissionMaps, useVisibleModules } from './permissions';
import { matchPath, useRouter } from './router';
import { useMember, useSessionState } from './session';
import { Shell } from './Shell';
import { applyTheme, readTheme } from './theme';

/** Modül + sekmeye göre sayfa. Sayfa bileşenleri taşınmadı; yalnız sekme kabuğunda gösterilir. */
function pageFor(mod: string, tab: string | undefined, rest: string[]) {
  switch (mod) {
    case '/': return <HomePage />;
    case '/uretim': return tab === 'mutfak' ? <KitchenScreen /> : tab === 'emir' ? <ProductionOrderPage /> : tab === 'kalibrasyon' ? <CalibrationPage /> : <PrepPage initialMeal={rest[0]} />;
    case '/menuler': return tab === 'plan' ? <MenuPlanPage /> : <MenusPage />;
    case '/receteler': return rest[0] ? <RecipeEditor id={rest[0] === 'yeni' ? null : rest[0]} /> : <RecipesPage />;
    case '/stok': return tab === 'sevk' ? <SuppliesPage /> : tab === 'kartlar' ? <IngredientsPage /> : <StockPage />;
    case '/satinalma': return <PurchasingPage />;
    case '/siparisler': return <OrdersPage />;
    case '/cari': return tab === 'tedarikciler' ? <SuppliersPage /> : <CustomersPage />;
    case '/personel': return tab === 'puantaj' ? <AttendancePage /> : tab === 'bakiye' ? <BalancesPage /> : <PersonnelPage />;
    case '/finans': return tab === 'giderler' ? <ExpensesPage /> : tab === 'faturalar' ? <InvoicesPage /> : <FinanceSummaryPage />;
    case '/kasa': return <CashPage />;
    case '/ayarlar': return tab === 'yetkiler' ? <FounderPage /> : <TeamPage />;
    default: return <NotFound />;
  }
}

function Routes() {
  const { path, go } = useRouter();
  const me = useMember();
  const perms = usePermissionMaps();
  const visible = useVisibleModules();
  const alias = resolveAlias(path);
  // Eski adres (yer imi) → yeni modül/sekme; geçmişte iz bırakmadan
  useEffect(() => { if (alias) go(alias, { replace: true }); }, [alias, go]);
  if (alias) return <Loading />;

  const { mod, tab, rest, tabs } = resolveRoute(path, me.role, perms);
  if (!mod || !visible.includes(mod) || (mod.tabs && !tab)) return <NotFound />;
  return (
    <>
      {tabs.length > 1 && !(mod.path === '/receteler' && rest.length) && <ModuleTabs mod={mod} tabs={tabs} active={tab?.id} />}
      <div key={`${mod.path}/${tab?.id ?? ''}`}>{pageFor(mod.path, tab?.id, rest)}</div>
    </>
  );
}

export function App() {
  const state = useSessionState();
  const { path } = useRouter();
  useEffect(() => { applyTheme(readTheme()); }, []);

  // Giriş gerektirmeyen sayfalar
  const card = matchPath('/kart/:slug', path);
  if (card && supabaseConfigured) return <CardPage slug={card.slug} />;
  const portal = matchPath('/siparis/:token', path);
  if (portal && supabaseConfigured) return <OrderPortalPage token={portal.token} />;

  if (!supabaseConfigured) return <SetupMissing />;
  if (state.status === 'loading') return <div className="min-h-dvh grid place-items-center"><Loading label="Oturum açılıyor…" /></div>;
  if (state.status === 'signedOut') return <LoginScreen />;
  if (state.status === 'pending') return <PendingAccess email={state.email} />;
  if (state.member.role === 'musteri') return <PortalComingSoon />;
  return <Shell><Routes /></Shell>;
}
