'use client';

import { EMOTIONS, type EmotionId } from '@marutime/config';
import type { Character, Device, Service } from '@marutime/db';
import { img } from '@marutime/metadata/images';
import { Button, CheckBurst, Chip, Dialog, Textarea, cn, springs, useToast } from '@marutime/ui';
import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { checkInEpisodeAction, checkInMovieAction, updateWatchAction } from '@/actions/tracking';
import { DeviceIcon } from './device-icon';

export type CheckInTarget = { kind: 'episode'; episodeId: number; label: string } | { kind: 'movie'; mediaId: number; label: string };

export type CheckInInitial = { watchId?: string; deviceId?: number | null; serviceId?: number | null; emotions?: string[]; favoriteCharacterId?: number | null; note?: string | null };

export type CheckInDialogProps = {
  open: boolean;
  onClose: () => void;
  target: CheckInTarget;
  devices: Device[];
  services: Service[];
  characters: Character[];
  guestCharacters?: Character[];
  initial?: CheckInInitial;
  defaults?: { deviceId?: number | null; serviceId?: number | null };
  onDone?: (result: { created: boolean; finishedShow?: boolean }) => void;
};

/**
 * TVTime-style check-in. Everything here is optional and private: it only ever
 * feeds anonymous aggregate stats. The watched state itself is saved instantly.
 */
export function CheckInDialog({ open, onClose, target, devices, services, characters, guestCharacters = [], initial, defaults, onDone }: CheckInDialogProps) {
  const [deviceId, setDeviceId] = useState<number | null>(initial?.deviceId ?? defaults?.deviceId ?? null);
  const [serviceId, setServiceId] = useState<number | null>(initial?.serviceId ?? defaults?.serviceId ?? null);
  const [emotions, setEmotions] = useState<EmotionId[]>((initial?.emotions ?? []) as EmotionId[]);
  const [characterId, setCharacterId] = useState<number | null>(initial?.favoriteCharacterId ?? null);
  const [note, setNote] = useState(initial?.note ?? '');
  const [showNote, setShowNote] = useState(Boolean(initial?.note));
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const toggleEmotion = (id: EmotionId) => setEmotions((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));

  const save = () => {
    start(async () => {
      const input = { deviceId, serviceId, emotions, favoriteCharacterId: characterId, note: note || null };
      const result = initial?.watchId
        ? await updateWatchAction(initial.watchId, input)
        : target.kind === 'episode'
          ? await checkInEpisodeAction(target.episodeId, input)
          : await checkInMovieAction(target.mediaId, input);
      if (!result.ok) {
        toast({ tone: 'error', title: 'Could not save', description: result.error });
        return;
      }
      setDone(true);
      const data = result.data as { created?: boolean; finishedShow?: boolean } | undefined;
      onDone?.({ created: data?.created ?? false, finishedShow: data?.finishedShow });
      router.refresh();
      setTimeout(() => {
        onClose();
        setDone(false);
      }, 900);
    });
  };

  const allCharacters = [...guestCharacters.map((c) => ({ ...c, guest: true })), ...characters.map((c) => ({ ...c, guest: false }))];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial?.watchId ? 'Edit your check-in' : 'How was it?'}
      description={target.label}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {initial?.watchId ? 'Cancel' : 'Skip'}
          </Button>
          <Button onClick={save} loading={pending} data-autofocus>
            {initial?.watchId ? 'Save changes' : 'Save check-in'}
          </Button>
        </>
      }
    >
      <AnimatePresence mode="wait">
        {done ? (
          <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3 py-12">
            <CheckBurst />
            <p className="text-sm font-medium text-fg">Saved</p>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} className="flex flex-col gap-7">
            <section>
              <h3 className="mb-3 text-sm font-semibold text-fg">How did you feel?</h3>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {EMOTIONS.map((e) => {
                  const on = emotions.includes(e.id);
                  return (
                    <motion.button
                      key={e.id}
                      type="button"
                      whileTap={{ scale: 0.92 }}
                      transition={springs.snappy}
                      aria-pressed={on}
                      onClick={() => toggleEmotion(e.id)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-card border px-2 py-3 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
                        on ? 'border-accent/60 bg-accent-soft text-fg' : 'border-border bg-surface-2 text-fg-muted hover:border-border-strong hover:text-fg',
                      )}
                    >
                      <motion.span animate={on ? { scale: [1, 1.35, 1], rotate: [0, -8, 0] } : { scale: 1 }} transition={springs.pop} className="text-2xl leading-none" aria-hidden>
                        {e.emoji}
                      </motion.span>
                      {e.label}
                    </motion.button>
                  );
                })}
              </div>
            </section>

            {allCharacters.length > 0 ? (
              <section>
                <h3 className="mb-1 text-sm font-semibold text-fg">Favorite character</h3>
                <p className="mb-3 text-xs text-fg-subtle">Who stole the {target.kind === 'episode' ? 'episode' : 'show'}?</p>
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 no-scrollbar">
                  {allCharacters.map((c) => {
                    const on = characterId === c.id;
                    const src = c.imageUrl ?? img.profile(c.profilePath, 'w185');
                    return (
                      <motion.button
                        key={c.id}
                        type="button"
                        whileTap={{ scale: 0.94 }}
                        transition={springs.snappy}
                        aria-pressed={on}
                        onClick={() => setCharacterId(on ? null : c.id)}
                        className={cn('flex w-20 shrink-0 flex-col items-center gap-1.5 rounded-card border p-2 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/60', on ? 'border-accent/60 bg-accent-soft' : 'border-border bg-surface-2 hover:border-border-strong')}
                      >
                        <span className={cn('size-14 overflow-hidden rounded-full bg-surface-3 ring-2 transition-[ring-color]', on ? 'ring-accent' : 'ring-transparent')}>
                          {src ? <img src={src} alt="" className="size-full object-cover" loading="lazy" /> : <span className="flex size-full items-center justify-center text-lg font-semibold text-fg-muted">{c.name[0]}</span>}
                        </span>
                        <span className="line-clamp-2 text-[11px] leading-tight font-medium text-fg">{c.name}</span>
                        {c.guest ? <span className="text-[9px] font-semibold tracking-wide text-accent uppercase">Guest</span> : null}
                      </motion.button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section className="grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="mb-3 text-sm font-semibold text-fg">Where did you watch?</h3>
                <div className="flex flex-wrap gap-2">
                  {services.map((s) => (
                    <Chip key={s.id} size="sm" selected={serviceId === s.id} onClick={() => setServiceId(serviceId === s.id ? null : s.id)}>
                      <span className="size-2 rounded-full" style={{ backgroundColor: s.color ?? 'currentColor' }} aria-hidden />
                      {s.name}
                    </Chip>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-semibold text-fg">On which device?</h3>
                <div className="flex flex-wrap gap-2">
                  {devices.map((d) => (
                    <Chip key={d.id} size="sm" selected={deviceId === d.id} onClick={() => setDeviceId(deviceId === d.id ? null : d.id)}>
                      <DeviceIcon icon={d.icon} className="size-3.5" />
                      {d.name}
                    </Chip>
                  ))}
                </div>
              </div>
            </section>

            <section>
              {showNote ? (
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="A private note for future you…" maxLength={500} rows={3} />
              ) : (
                <button type="button" onClick={() => setShowNote(true)} className="text-sm text-fg-muted hover:text-fg">
                  + Add a private note
                </button>
              )}
            </section>
            <p className="text-xs text-fg-subtle">Your device, service, feelings and favorite character are private. They only ever appear in anonymous totals.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </Dialog>
  );
}
