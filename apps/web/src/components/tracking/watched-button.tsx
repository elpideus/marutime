'use client';

import type { Character, Device, Service } from '@marutime/db';
import { Button, cn, springs, useToast } from '@marutime/ui';
import { Check, Pencil, Plus, Repeat, Undo2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { checkInEpisodeAction, checkInMovieAction, unwatchEpisodeAction, unwatchMovieAction } from '@/actions/tracking';
import { CheckInDialog, type CheckInInitial, type CheckInTarget } from './check-in-dialog';

export type WatchedButtonProps = {
  target: CheckInTarget;
  watched: boolean;
  watchCount?: number;
  lastWatch?: CheckInInitial | null;
  devices: Device[];
  services: Service[];
  characters: Character[];
  guestCharacters?: Character[];
  defaults?: { deviceId?: number | null; serviceId?: number | null };
  size?: 'sm' | 'md' | 'lg';
  variant?: 'full' | 'compact';
  signedIn: boolean;
  className?: string;
};

/**
 * One tap marks it watched (instant, optimistic) and opens the details sheet.
 * Already watched → edit details, log a rewatch, or undo.
 */
export function WatchedButton({ target, watched, watchCount = 0, lastWatch, devices, services, characters, guestCharacters, defaults, size = 'md', variant = 'full', signedIn, className }: WatchedButtonProps) {
  const [isWatched, setIsWatched] = useState(watched);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'new' | 'edit' | 'rewatch'>('new');
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  if (!signedIn) {
    return (
      <Button size={size} variant="secondary" className={className} onClick={() => router.push(`/login?next=${encodeURIComponent(location.pathname)}`)}>
        <Check className="size-4" /> Mark watched
      </Button>
    );
  }

  const markWatched = () => {
    setIsWatched(true);
    setMode('new');
    setOpen(true);
    start(async () => {
      const result = target.kind === 'episode' ? await checkInEpisodeAction(target.episodeId, { ...defaults }) : await checkInMovieAction(target.mediaId, { ...defaults });
      if (!result.ok) {
        setIsWatched(false);
        setOpen(false);
        toast({ tone: 'error', title: 'Could not mark as watched', description: result.error });
        return;
      }
      if ('finishedShow' in result.data && result.data.finishedShow) toast({ tone: 'success', title: 'Show complete! 🎉', description: 'You watched every aired episode.' });
      router.refresh();
    });
  };

  const undo = () => {
    setIsWatched(false);
    start(async () => {
      const result = target.kind === 'episode' ? await unwatchEpisodeAction(target.episodeId) : await unwatchMovieAction(target.mediaId);
      if (!result.ok) {
        setIsWatched(true);
        toast({ tone: 'error', title: 'Could not undo', description: result.error });
        return;
      }
      router.refresh();
    });
  };

  return (
    <>
      <div className={cn('flex items-center gap-2', className)}>
        {isWatched ? (
          <>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} transition={springs.pop}>
              <Button size={size} variant="accent-soft" onClick={() => { setMode('edit'); setOpen(true); }} aria-label="Edit check-in">
                <Check className="size-4" /> Watched{watchCount > 1 ? ` ×${watchCount}` : ''}
                {variant === 'full' ? <Pencil className="size-3.5 opacity-70" /> : null}
              </Button>
            </motion.div>
            {variant === 'full' ? (
              <>
                <Button size={size === 'lg' ? 'icon-lg' : size === 'sm' ? 'icon-sm' : 'icon'} variant="ghost" onClick={() => { setMode('rewatch'); setOpen(true); }} aria-label="Log a rewatch" title="Log a rewatch">
                  <Repeat className="size-4" />
                </Button>
                <Button size={size === 'lg' ? 'icon-lg' : size === 'sm' ? 'icon-sm' : 'icon'} variant="ghost" onClick={undo} loading={pending} aria-label="Undo watched" title="Undo">
                  <Undo2 className="size-4" />
                </Button>
              </>
            ) : null}
          </>
        ) : (
          <Button size={size} onClick={markWatched} loading={pending}>
            {variant === 'compact' ? <Plus className="size-4" /> : <Check className="size-4" />} {variant === 'compact' ? 'Watched' : 'Mark watched'}
          </Button>
        )}
      </div>
      <CheckInDialog
        open={open}
        onClose={() => setOpen(false)}
        target={target}
        devices={devices}
        services={services}
        characters={characters}
        guestCharacters={guestCharacters}
        defaults={defaults}
        initial={mode === 'edit' ? (lastWatch ?? undefined) : mode === 'rewatch' ? { emotions: [] } : undefined}
        key={`${mode}-${open}`}
      />
    </>
  );
}
