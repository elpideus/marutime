import { formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';

export function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : parseISO(value);
  return isValid(d) ? d : null;
}

export function formatDate(value: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  const d = toDate(value);
  return d ? new Intl.DateTimeFormat('en-GB', opts).format(d) : '—';
}

export function formatDateTime(value: Date | string | null | undefined): string {
  return formatDate(value, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatRelative(value: Date | string | null | undefined): string {
  const d = toDate(value);
  if (!d) return '';
  const diff = Date.now() - d.getTime();
  if (Math.abs(diff) < 60_000) return 'just now';
  const text = formatDistanceToNowStrict(d, { addSuffix: true });
  return text.replace(' minutes', ' min').replace(' minute', ' min').replace(' hours', 'h').replace(' hour', 'h');
}

export function yearOf(value: string | null | undefined): string {
  return value ? value.slice(0, 4) : '';
}

export function formatRuntime(minutes: number | null | undefined): string {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
}

/** Long durations for stats: "3 months, 4 days" / "2 days, 5 hours" / "45 minutes". */
export function formatWatchTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const totalHours = Math.floor(minutes / 60);
  if (totalHours < 24) return `${totalHours}h ${minutes % 60}m`;
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days < 30) return `${days}d ${hours}h`;
  const months = Math.floor(days / 30);
  return `${months}mo ${days % 30}d`;
}

export function episodeCode(season: number, episode: number): string {
  return `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
}

export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

export function pluralize(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function daysUntilLabel(days: number): string {
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `In ${days} days`;
  if (days < 30) return `In ${Math.round(days / 7)} wk`;
  return `In ${Math.round(days / 30)} mo`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
