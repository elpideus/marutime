import { img } from '@marutime/metadata/images';
import { cn } from '@marutime/ui';

export type PosterProps = {
  path: string | null | undefined;
  title: string;
  size?: 'w185' | 'w342' | 'w500' | 'w780';
  className?: string;
  priority?: boolean;
  rounded?: 'card' | 'control' | 'none';
  /** Absolute URL alternative (e.g. AniList cover). */
  src?: string | null;
};

function hue(title: string): number {
  let h = 0;
  for (const c of title) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

/** Poster image with a tasteful typographic fallback. Always 2:3. */
export function Poster({ path, title, size = 'w342', className, priority, rounded = 'card', src }: PosterProps) {
  const url = src ?? img.poster(path, size);
  const radius = rounded === 'card' ? 'rounded-card' : rounded === 'control' ? 'rounded-control' : '';
  if (!url) {
    return (
      <div
        className={cn('flex aspect-[2/3] w-full items-end overflow-hidden p-3', radius, className)}
        style={{ background: `linear-gradient(160deg, hsl(${hue(title)} 30% 24%), hsl(${(hue(title) + 40) % 360} 28% 12%))` }}
        role="img"
        aria-label={title}
      >
        <span className="line-clamp-3 text-sm font-semibold leading-tight text-white/85">{title}</span>
      </div>
    );
  }
  return (
    <img
      src={url}
      srcSet={src ? undefined : img.posterSet(path)}
      sizes="(min-width: 1024px) 180px, (min-width: 640px) 160px, 40vw"
      alt={title}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={cn('aspect-[2/3] w-full bg-surface-3 object-cover', radius, className)}
    />
  );
}

export function Backdrop({ path, className, alt = '' }: { path: string | null | undefined; className?: string; alt?: string }) {
  const url = img.backdrop(path, 'w1280');
  if (!url) return <div className={cn('bg-gradient-to-br from-surface-3 to-surface', className)} aria-hidden />;
  return <img src={url} alt={alt} className={cn('object-cover', className)} loading="eager" decoding="async" />;
}

export function Still({ path, alt, className }: { path: string | null | undefined; alt: string; className?: string }) {
  const url = img.still(path, 'w300');
  if (!url) return <div className={cn('aspect-video w-full bg-gradient-to-br from-surface-3 to-surface-2', className)} aria-hidden />;
  return <img src={url} alt={alt} className={cn('aspect-video w-full bg-surface-3 object-cover', className)} loading="lazy" decoding="async" />;
}
