import { ModuleHero } from '@/ui/primitives';
import { MonthMenuCalendar } from './menu-calendar/MonthMenuCalendar';

/** Menüler › Aylık menü (EK-1 / Not 1, 3, 14): menüler aylıktır; her gün × öğün için yemek buradan seçilir ve yayınlanır. */
export function MonthlyMenuPage() {
  return (
    <>
      <ModuleHero kicker="Mutfak · Menüler" title="Aylık menü takvimi"
        description="Menüler aylıktır. Her gün × öğün için yemekler buradan seçilir; genel ve müşteriye özel menü ayrı sürümlerle tutulur. Yayınlanan ay günlük menü planına yazılır, üretim ve sipariş ekranları onu kullanır." />
      <MonthMenuCalendar mode="menu" />
    </>
  );
}
