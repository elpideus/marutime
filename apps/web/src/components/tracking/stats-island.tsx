import type { TargetStats } from '@marutime/core';
import { img } from '@marutime/metadata/images';
import { Island, IslandHeader, ProgressBar } from '@marutime/ui';
import { Users } from 'lucide-react';
import { DeviceIcon } from './device-icon';

/** Anonymous aggregate stats; hidden until enough people have checked in. */
export function StatsIsland({ stats, title = 'What viewers felt' }: { stats: TargetStats; title?: string }) {
  return (
    <Island>
      <IslandHeader title={title} description={`${stats.viewers} ${stats.viewers === 1 ? 'viewer' : 'viewers'} · ${stats.watches} ${stats.watches === 1 ? 'check-in' : 'check-ins'}`} />
      {stats.hidden ? (
        <div className="flex items-center gap-3 rounded-card border border-dashed border-border px-4 py-5 text-sm text-fg-muted">
          <Users className="size-5 shrink-0 text-fg-subtle" />
          Stats appear once at least 3 people have checked in, so nobody can be singled out.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h4 className="mb-2 text-xs font-semibold tracking-wide text-fg-subtle uppercase">Reactions</h4>
            {stats.emotions.length === 0 ? <p className="text-sm text-fg-muted">No reactions yet.</p> : null}
            <ul className="flex flex-col gap-2">
              {stats.emotions.map((e) => (
                <li key={e.item.id} className="flex items-center gap-3 text-sm">
                  <span className="w-6 text-lg leading-none" aria-hidden>{e.item.emoji}</span>
                  <span className="w-14 text-fg">{e.item.label}</span>
                  <ProgressBar value={e.percent} size="sm" className="flex-1" label={`${e.item.label} ${e.percent}%`} />
                  <span className="w-10 text-right text-xs text-fg-muted tabular-nums">{e.percent}%</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-5">
            {stats.favoriteCharacters.length > 0 ? (
              <div>
                <h4 className="mb-2 text-xs font-semibold tracking-wide text-fg-subtle uppercase">Favorite characters</h4>
                <ul className="flex flex-wrap gap-2">
                  {stats.favoriteCharacters.map((c) => {
                    const src = c.item.imageUrl ?? img.profile(c.item.profilePath, 'w185');
                    return (
                      <li key={c.item.id} className="flex items-center gap-2 rounded-pill border border-border bg-surface-2 py-1 pr-3 pl-1 text-xs">
                        <span className="size-6 overflow-hidden rounded-full bg-surface-3">{src ? <img src={src} alt="" className="size-full object-cover" /> : null}</span>
                        <span className="font-medium text-fg">{c.item.name}</span>
                        <span className="text-fg-muted tabular-nums">{c.percent}%</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
            {stats.services.length > 0 ? (
              <div>
                <h4 className="mb-2 text-xs font-semibold tracking-wide text-fg-subtle uppercase">Watched on</h4>
                <ul className="flex flex-wrap gap-2">
                  {stats.services.slice(0, 6).map((s) => (
                    <li key={s.item.id} className="flex items-center gap-1.5 rounded-pill border border-border bg-surface-2 px-2.5 py-1 text-xs">
                      <span className="size-2 rounded-full" style={{ backgroundColor: s.item.color ?? 'currentColor' }} />
                      <span className="text-fg">{s.item.name}</span>
                      <span className="text-fg-muted tabular-nums">{s.percent}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {stats.devices.length > 0 ? (
              <div>
                <h4 className="mb-2 text-xs font-semibold tracking-wide text-fg-subtle uppercase">Devices</h4>
                <ul className="flex flex-wrap gap-2">
                  {stats.devices.slice(0, 6).map((d) => (
                    <li key={d.item.id} className="flex items-center gap-1.5 rounded-pill border border-border bg-surface-2 px-2.5 py-1 text-xs">
                      <DeviceIcon icon={d.item.icon} className="size-3.5 text-fg-muted" />
                      <span className="text-fg">{d.item.name}</span>
                      <span className="text-fg-muted tabular-nums">{d.percent}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </Island>
  );
}
