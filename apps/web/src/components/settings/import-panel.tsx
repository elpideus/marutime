'use client';

import type { ImportJobView } from '@marutime/core';
import { isTvTimeFile, parseTvTime, summarize, type ImportItemInput, type ImportSummary } from '@marutime/core/import-format';
import { Button, Input, Island, IslandHeader, ProgressBar, cn, springs, useToast } from '@marutime/ui';
import { CheckCircle2, ChevronDown, CircleAlert, FileArchive, LoaderCircle, Pause, Play, Upload, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { formatRelative } from '@/lib/format';

type Job = Omit<ImportJobView, 'createdAt' | 'updatedAt' | 'finishedAt'> & { createdAt: string | Date; updatedAt: string | Date; finishedAt: string | Date | null };

const active = (j: Job | null | undefined) => j?.status === 'pending' || j?.status === 'running';
const nf = new Intl.NumberFormat('en');
const plural = (n: number, one: string, many = `${one}s`) => `${nf.format(n)} ${n === 1 ? one : many}`;

async function readTvTimeZip(file: File): Promise<ImportItemInput[]> {
  const { unzip } = await import('fflate');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) =>
    unzip(bytes, { filter: (f) => isTvTimeFile(f.name) }, (err, out) => (err ? reject(err) : resolve(out))),
  );
  const decoder = new TextDecoder('utf-8');
  const files: Record<string, string> = {};
  for (const [name, data] of Object.entries(entries)) files[name.split('/').pop()!] = decoder.decode(data);
  if (!files['tracking-prod-records-v2.csv'] && !files['tracking-prod-records.csv'] && !files['seen_episode.csv'] && !files['followed_tv_show.csv']) {
    throw new Error('This does not look like a TV Time export. Use the zip TV Time support sent you.');
  }
  return parseTvTime(files);
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw Object.assign(new Error(body.error ?? 'Something went wrong'), { status: res.status });
  return body;
}

export function ImportPanel({ initialJobs }: { initialJobs: Job[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const current = jobs.find(active) ?? null;
  const [paused, setPaused] = useState(false);

  const upsert = useCallback((job: Job) => setJobs((list) => [job, ...list.filter((j) => j.id !== job.id)].slice(0, 5)), []);

  // Drive the active import while this page is open: one step after another, backing off on errors.
  const currentId = current?.id ?? null;
  useEffect(() => {
    if (!currentId || paused) return;
    let cancelled = false;
    void (async () => {
      let failures = 0;
      while (!cancelled) {
        try {
          const { job } = await api<{ job: Job }>(`/api/imports/${currentId}/step`, { method: 'POST' });
          if (cancelled) break;
          failures = 0;
          upsert(job);
          if (!active(job)) {
            if (job.status === 'completed') router.refresh();
            break;
          }
        } catch (err) {
          failures += 1;
          if ((err as { status?: number }).status === 404 || failures >= 5) {
            if (!cancelled) setPaused(true);
            break;
          }
          await new Promise((r) => setTimeout(r, 1500 * 2 ** failures));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentId, paused, upsert, router]);

  const start = async (body: Record<string, unknown>) => {
    const { job } = await api<{ job: Job }>('/api/imports', { method: 'POST', body: JSON.stringify(body) });
    setPaused(false);
    upsert(job);
  };

  const cancel = async () => {
    if (!current) return;
    try {
      const { job } = await api<{ job: Job }>(`/api/imports/${current.id}`, { method: 'DELETE' });
      upsert(job);
      router.refresh();
    } catch (err) {
      toast({ tone: 'error', title: (err as Error).message });
    }
  };

  return (
    <Island>
      <IslandHeader title="Import from another tracker" description="Bring your history over: shows you follow, every episode and movie you watched (with dates), your watchlist and lists. Importing twice never doubles anything." />
      <AnimatePresence mode="wait" initial={false}>
        {current ? (
          <motion.div key="progress" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={springs.smooth}>
            <JobProgress job={current} paused={paused} onResume={() => setPaused(false)} onCancel={cancel} />
          </motion.div>
        ) : (
          <motion.div key="sources" className="grid gap-3 md:grid-cols-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={springs.smooth}>
            <TvTimeSource onStart={(items) => start({ source: 'tvtime', items })} />
            <AniListSource onStart={(username) => start({ source: 'anilist', username })} />
          </motion.div>
        )}
      </AnimatePresence>
      {jobs.filter((j) => !active(j)).length > 0 ? (
        <div className="mt-5 border-t border-border pt-4">
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-fg-subtle uppercase">Recent imports</h3>
          <ul className="flex flex-col gap-2">
            {jobs.filter((j) => !active(j)).map((j) => (
              <PastJob key={j.id} job={j} />
            ))}
          </ul>
        </div>
      ) : null}
    </Island>
  );
}

function SourceCard({ title, body, children }: { title: string; body: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-2/50 p-4">
      <div>
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-fg-muted">{body}</p>
      </div>
      {children}
    </div>
  );
}

function SummaryLine({ s }: { s: ImportSummary }) {
  const parts = [
    s.shows && plural(s.shows, 'show'),
    s.movies && plural(s.movies, 'movie'),
    s.viewings && plural(s.viewings, 'viewing'),
    s.watchlist && `${nf.format(s.watchlist)} on your watchlist`,
    s.lists && plural(s.lists, 'list'),
  ].filter(Boolean);
  return <p className="text-xs text-fg-muted tabular-nums">{parts.join(' · ')}</p>;
}

function TvTimeSource({ onStart }: { onStart: (items: ImportItemInput[]) => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ phase: 'idle' } | { phase: 'reading'; name: string } | { phase: 'ready'; name: string; items: ImportItemInput[] } | { phase: 'starting'; name: string; items: ImportItemInput[] }>({ phase: 'idle' });
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setState({ phase: 'reading', name: file.name });
    try {
      // Let the "Reading" state paint before parsing takes over the main thread.
      await new Promise((r) => setTimeout(r, 30));
      const items = await readTvTimeZip(file);
      if (!items.length) throw new Error('Nothing to import was found in this export.');
      setState({ phase: 'ready', name: file.name, items });
    } catch (err) {
      setError((err as Error).message.includes('invalid zip') ? 'That file is not a valid zip.' : (err as Error).message);
      setState({ phase: 'idle' });
    }
  };

  const go = async () => {
    if (state.phase !== 'ready') return;
    setState({ ...state, phase: 'starting' });
    try {
      await onStart(state.items);
      setState({ phase: 'idle' });
      if (input.current) input.current.value = '';
    } catch (err) {
      setError((err as Error).message);
      setState({ ...state, phase: 'ready' });
    }
  };

  return (
    <SourceCard title="TV Time" body="Upload the zip TV Time support sent you (your GDPR data export). It is read on this device; only your watch history is sent to MaruTime.">
      <input ref={input} type="file" accept=".zip,application/zip" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} tabIndex={-1} />
      {state.phase === 'ready' || state.phase === 'starting' ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2 rounded-control bg-surface-3/60 px-3 py-2">
            <FileArchive className="mt-0.5 size-4 shrink-0 text-fg-muted" />
            <div className="min-w-0">
              <p className="truncate text-sm text-fg">{state.name}</p>
              <SummaryLine s={summarize(state.items)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void go()} loading={state.phase === 'starting'}>
              <Upload className="size-4" /> Import
            </Button>
            <Button variant="ghost" onClick={() => input.current?.click()} disabled={state.phase === 'starting'}>
              Choose another file
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" className="self-start" onClick={() => input.current?.click()} loading={state.phase === 'reading'}>
          <FileArchive className="size-4" /> {state.phase === 'reading' ? 'Reading the export…' : 'Choose the .zip'}
        </Button>
      )}
      {error ? <p className="flex items-start gap-1.5 text-xs text-danger"><CircleAlert className="mt-px size-3.5 shrink-0" /> {error}</p> : null}
    </SourceCard>
  );
}

function AniListSource({ onStart }: { onStart: (username: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    setError(null);
    try {
      await onStart(name.trim());
      setName('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };
  return (
    <SourceCard title="AniList" body="Your anime list, matched season by season to the right shows and episodes. The list needs to be public while it imports.">
      <form onSubmit={go} className="flex flex-col gap-2 sm:flex-row">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="AniList username" aria-label="AniList username" autoComplete="off" spellCheck={false} className="min-w-0 flex-1" />
        <Button type="submit" disabled={!name.trim()} loading={pending}>
          <Upload className="size-4" /> Import
        </Button>
      </form>
      {error ? <p className="flex items-start gap-1.5 text-xs text-danger"><CircleAlert className="mt-px size-3.5 shrink-0" /> {error}</p> : null}
    </SourceCard>
  );
}

function Counters({ job }: { job: Job }) {
  const s = job.stats;
  const items = [
    ['Shows', s.shows],
    ['Movies', s.movies],
    ['Viewings', s.watches],
    ['Watchlist', s.watchlist],
    ['Lists', s.lists],
  ] as const;
  return (
    <dl className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {items.map(([label, n]) => (
        <div key={label} className="rounded-control bg-surface-2/60 px-3 py-2">
          <dt className="text-[11px] text-fg-subtle">{label}</dt>
          <dd className="text-base font-semibold text-fg tabular-nums">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={n} className="inline-block" initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0, transition: { duration: 0.1 } }} transition={springs.snappy}>
                {nf.format(n)}
              </motion.span>
            </AnimatePresence>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function JobProgress({ job, paused, onResume, onCancel }: { job: Job; paused: boolean; onResume: () => void; onCancel: () => void }) {
  const pct = job.total ? (job.cursor / job.total) * 100 : 0;
  return (
    <div className="flex flex-col gap-4 rounded-card border border-accent/25 bg-accent-soft/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {paused ? <Pause className="size-4 text-fg-muted" /> : <LoaderCircle className="size-4 animate-spin text-accent" />}
          <div>
            <p className="text-sm font-semibold text-fg">{paused ? `${job.label} import paused` : `Importing from ${job.label}`}</p>
            <p className="text-xs text-fg-muted tabular-nums">
              {nf.format(job.cursor)} of {nf.format(job.total)} items{paused ? '' : ' · keep this page open (you can use MaruTime in another tab)'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {paused ? (
            <Button size="sm" onClick={onResume}>
              <Play className="size-4" /> Resume
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={onCancel} tooltip="Stop here. What is already imported stays.">
            <X className="size-4" /> Cancel
          </Button>
        </div>
      </div>
      <ProgressBar value={pct} label="Import progress" />
      <Counters job={job} />
      {job.error && !paused ? <p className="text-xs text-fg-subtle">Retrying after a hiccup: {job.error}</p> : null}
    </div>
  );
}

function PastJob({ job }: { job: Job }) {
  const [open, setOpen] = useState(false);
  const s = job.stats;
  const unmatched = s.unmatched;
  const ok = job.status === 'completed';
  return (
    <li className="rounded-card border border-border bg-surface-2/40 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {ok ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <CircleAlert className="size-4 shrink-0 text-fg-subtle" />}
          <p className="truncate text-sm text-fg">
            {job.label} <span className="text-fg-subtle">· {job.status === 'cancelled' ? 'cancelled' : job.status === 'failed' ? 'failed' : 'done'} {formatRelative(new Date(job.finishedAt ?? job.updatedAt))}</span>
          </p>
        </div>
        <p className="text-xs text-fg-muted tabular-nums">
          {plural(s.shows, 'show')} · {plural(s.movies, 'movie')} · {plural(s.watches, 'viewing')}{s.lists ? ` · ${plural(s.lists, 'list')}` : ''}
        </p>
      </div>
      {unmatched.length || s.skippedEpisodes ? (
        <div className="mt-1.5">
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex items-center gap-1 text-xs text-fg-muted transition-colors hover:text-fg">
            <ChevronDown className={cn('size-3.5 transition-transform duration-300 ease-spring', open && 'rotate-180')} />
            {unmatched.length ? `${nf.format(unmatched.length)}${unmatched.length >= 300 ? '+' : ''} ${unmatched.length === 1 ? 'title' : 'titles'} not matched` : ''}
            {unmatched.length && s.skippedEpisodes ? ' · ' : ''}
            {s.skippedEpisodes ? `${plural(s.skippedEpisodes, 'episode')} skipped` : ''}
          </button>
          <AnimatePresence initial={false}>
            {open ? (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={springs.smooth} className="overflow-hidden">
                {s.skippedEpisodes ? <p className="mt-2 text-xs text-fg-subtle">Skipped episodes are ones with no counterpart on TMDB (often specials or extras numbered differently).</p> : null}
                {unmatched.length ? (
                  <ul className="mt-2 max-h-56 overflow-y-auto rounded-control border border-border bg-surface px-3 py-2 text-xs">
                    {unmatched.map((u, i) => (
                      <li key={i} className="flex justify-between gap-3 py-0.5">
                        <span className="truncate text-fg">{u.title}</span>
                        <span className="shrink-0 text-fg-subtle">{u.kind} · {u.reason}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}
    </li>
  );
}
