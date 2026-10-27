import type { IconName } from '../components/Controls';

export const DESTINATIONS = [
  { href: '/', label: 'Explore', title: 'Chromatic explorer', icon: 'compass' },
  { href: '/practice', label: 'Listen', title: 'Ear training', icon: 'headphones' },
  { href: '/guitar/trainer', label: 'Strum', title: 'Strumming & rhythm', icon: 'activity' },
  { href: '/guitar/chords', label: 'Chords', title: 'Chord transitions', icon: 'grid' },
  { href: '/guitar/routines', label: 'Routines', title: 'Practice routines', icon: 'list' },
  { href: '/guitar/history', label: 'History', title: 'Practice history', icon: 'bar-chart-2' },
] as const satisfies readonly { href: string; label: string; title: string; icon: IconName }[];

// Editors and active exercises keep their focused layouts without global navigation.
export function primaryDestination(pathname: string) {
  return DESTINATIONS.find((destination) => destination.href === pathname);
}
