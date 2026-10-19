'use client';

import { Button, Dialog, cn } from '@marutime/ui';
import { ExternalLink, Pause, Play } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useCommands } from '@/components/keyboard/command-palette';
import { useShortcut, useShortcutKeys } from '@/components/keyboard/shortcut-provider';

/*
 * Minimal slice of the YouTube IFrame Player API we use.
 * https://developers.google.com/youtube/iframe_api_reference
 */
type YTPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  mute(): void;
  getCurrentTime(): number;
  destroy(): void;
};
type YTNamespace = {
  Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
};
type YTWindow = Window & { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void };

let apiPromise: Promise<YTNamespace> | null = null;
function loadYouTube(): Promise<YTNamespace> {
  const w = window as YTWindow;
  if (w.YT?.Player) return Promise.resolve(w.YT);
  apiPromise ??= new Promise((resolve, reject) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (w.YT) resolve(w.YT);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => {
      apiPromise = null;
      reject(new Error('YouTube unavailable'));
    };
    document.head.appendChild(s);
  });
  return apiPromise;
}

/** Background playback only where it makes sense: big screens, a mouse, motion allowed, no data saver. */
function canAutoplay(): boolean {
  if (typeof window === 'undefined') return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && !conn?.saveData;
}

/** Seconds skipped at the start, past studio cards. */
const START_AT = 3;

type TrailerState = {
  /** Background video has started playing at least once. */
  ready: boolean;
  playing: boolean;
  togglePause: () => void;
  openModal: () => void;
  setHost: (el: HTMLDivElement | null) => void;
};

const TrailerContext = createContext<TrailerState | null>(null);

export function TrailerProvider({ trailerKey, title, autoplay, children }: { trailerKey: string; title: string; autoplay: boolean; children: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const player = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const userPaused = useRef(false);
  const [modal, setModal] = useState<{ open: boolean; start: number }>({ open: false, start: 0 });

  useEffect(() => {
    if (!autoplay || !host || !canAutoplay()) return;
    let cancelled = false;
    // Let the page settle first; the trailer is a nicety, not the content.
    const timer = setTimeout(() => {
      loadYouTube()
        .then((YT) => {
          if (cancelled) return;
          const mount = document.createElement('div');
          host.appendChild(mount);
          player.current = new YT.Player(mount, {
            host: 'https://www.youtube-nocookie.com',
            videoId: trailerKey,
            width: '100%',
            height: '100%',
            playerVars: { autoplay: 1, mute: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, loop: 1, playlist: trailerKey, playsinline: 1, rel: 0, start: START_AT, cc_load_policy: 0 },
            events: {
              onReady: (e: { target: YTPlayer }) => {
                e.target.mute();
                if (!userPaused.current && document.visibilityState === 'visible') e.target.playVideo();
              },
              onStateChange: (e: { data: number }) => {
                if (e.data === YT.PlayerState.PLAYING) {
                  setPlaying(true);
                  // Reveal a beat after playback starts, once YouTube's own overlays are gone.
                  setTimeout(() => !cancelled && setReady(true), 700);
                } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) setPlaying(false);
              },
              // Embedding disabled, removed or region-blocked: keep the cover image.
              onError: () => {
                player.current?.destroy();
                player.current = null;
                setReady(false);
                setPlaying(false);
              },
            },
          });
        })
        .catch(() => {});
    }, 1200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      player.current?.destroy();
      player.current = null;
    };
  }, [autoplay, host, trailerKey]);

  // Pause when the hero scrolls away or the tab is hidden; resume if the viewer did not pause it.
  useEffect(() => {
    if (!host) return;
    let visible = true;
    const sync = () => {
      const p = player.current;
      if (!p) return;
      if (visible && document.visibilityState === 'visible' && !userPaused.current) p.playVideo();
      else p.pauseVideo();
    };
    const io = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      sync();
    }, { threshold: 0.15 });
    io.observe(host);
    document.addEventListener('visibilitychange', sync);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [host]);

  const togglePause = useCallback(() => {
    const p = player.current;
    if (!p) return;
    if (playing) {
      userPaused.current = true;
      p.pauseVideo();
    } else {
      userPaused.current = false;
      p.playVideo();
    }
  }, [playing]);

  const openModal = useCallback(() => {
    const p = player.current;
    // Pick up exactly where the background trailer was (or from the top if it never ran).
    const start = p && ready ? Math.max(0, Math.floor(p.getCurrentTime())) : 0;
    if (p) {
      userPaused.current = true;
      p.pauseVideo();
    }
    setModal({ open: true, start });
  }, [ready]);

  const value = useMemo(() => ({ ready, playing, togglePause, openModal, setHost }), [ready, playing, togglePause, openModal]);

  return (
    <TrailerContext.Provider value={value}>
      {children}
      <Dialog open={modal.open} onClose={() => setModal((m) => ({ ...m, open: false }))} title={`${title} · Trailer`} size="xl" className="sm:max-w-5xl">
        {modal.open ? (
          <div className="flex flex-col gap-3">
            <div className="relative aspect-video w-full overflow-hidden rounded-card bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&start=${modal.start}&rel=0&playsinline=1`}
                title={`${title} trailer`}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                className="absolute inset-0 size-full"
              />
            </div>
            <a href={`https://www.youtube.com/watch?v=${trailerKey}&t=${modal.start}s`} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1 text-xs text-fg-muted transition-colors hover:text-fg">
              Watch on YouTube <ExternalLink className="size-3" />
            </a>
          </div>
        ) : null}
      </Dialog>
    </TrailerContext.Provider>
  );
}

/**
 * The video layer, covering the hero like `object-fit: cover`. It stays up
 * once playback has started (a paused frame is still a fine backdrop) and
 * only goes away if the player fails.
 */
export function TrailerBackdrop() {
  const ctx = useContext(TrailerContext);
  if (!ctx) return null;
  const { setHost, ready } = ctx;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden [container-type:size]" aria-hidden>
      <div
        ref={setHost}
        className={cn(
          'absolute top-1/2 left-1/2 h-[max(100cqh,56.25cqw)] w-[max(100cqw,177.78cqh)] -translate-x-1/2 -translate-y-1/2 scale-[1.18] transition-opacity duration-[1200ms] ease-smooth [&>iframe]:size-full',
          ready ? 'opacity-75' : 'opacity-0',
        )}
      />
    </div>
  );
}

/**
 * The cover image, layered above the video. When the trailer starts it
 * dissolves (fade, a slight drift and blur) until it is fully gone, while the
 * video fades in underneath; if the player fails it comes back.
 */
export function TrailerCover({ children }: { children: ReactNode }) {
  const ready = useContext(TrailerContext)?.ready ?? false;
  return (
    <div className={cn('absolute inset-0 transition-[opacity,scale,filter] duration-[1800ms] ease-smooth', ready ? 'pointer-events-none scale-[1.04] opacity-0 blur-md' : 'opacity-100')} aria-hidden={ready || undefined}>
      {children}
    </div>
  );
}

/** Trailer button (opens the modal) plus a pause/play toggle for the background video. */
export function TrailerButtons() {
  const ctx = useContext(TrailerContext);
  const keys = useShortcutKeys('title.trailer');
  useShortcut('title.trailer', ctx?.openModal);
  useCommands(ctx ? [{ id: 'trailer', group: 'This page', title: 'Play the trailer', shortcutId: 'title.trailer', perform: ctx.openModal }, ...(ctx.ready ? [{ id: 'trailer-bg', group: 'This page', title: ctx.playing ? 'Pause the background trailer' : 'Resume the background trailer', perform: ctx.togglePause }] : [])] : null);
  if (!ctx) return null;
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" onClick={ctx.openModal} tooltip={ctx.ready ? 'Watch the trailer with sound, from here' : 'Watch the trailer'} tooltipShortcut={keys}>
        <Play className="size-4" /> Trailer
      </Button>
      <AnimatePresence>
        {ctx.ready ? (
          <motion.div initial={{ opacity: 0, scale: 0.6, x: -6 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.6 }} transition={{ type: 'spring', visualDuration: 0.35, bounce: 0.4 }}>
            <Button variant="ghost" size="icon" onClick={ctx.togglePause} aria-label={ctx.playing ? 'Pause background trailer' : 'Play background trailer'} tooltip={ctx.playing ? 'Pause background trailer' : 'Play background trailer'}>
              {ctx.playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
