import { CircleEllipsis, Clapperboard, Gamepad2, Glasses, Laptop, Monitor, Projector, Smartphone, Tablet, Tv } from 'lucide-react';

const ICONS = { tv: Tv, smartphone: Smartphone, tablet: Tablet, laptop: Laptop, monitor: Monitor, clapperboard: Clapperboard, projector: Projector, 'gamepad-2': Gamepad2, glasses: Glasses, 'circle-ellipsis': CircleEllipsis } as const;

export function DeviceIcon({ icon, className }: { icon: string | null | undefined; className?: string }) {
  const Icon = (icon && (ICONS as Record<string, typeof Tv>)[icon]) || CircleEllipsis;
  return <Icon className={className} aria-hidden />;
}
