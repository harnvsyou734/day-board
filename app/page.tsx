import DayBoard from '@/components/DayBoard';
import { todayISO } from '@/lib/dates';

// Rendered per request so "today" is always the current Bangkok day, never a
// day baked in at build time.
export const dynamic = 'force-dynamic';

export default function Page() {
  return <DayBoard today={todayISO()} />;
}
