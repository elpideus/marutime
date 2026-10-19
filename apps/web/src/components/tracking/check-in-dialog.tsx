'use client';

import { EMOTIONS, type EmotionId } from '@marutime/config';
import type { Device, Service } from '@marutime/db';
import { img } from '@marutime/metadata/images';
import { Button, Chip, Dialog, Skeleton, Textarea, Tooltip, cn, springs } from '@marutime/ui';
import { Lock } from 'lucide-react';
import { motion } from 'motion/react';
import { useId, useState } from 'react';
import { ScrollRow } from '@/components/scroll-row';
import { SERVICE_DEVICE_HINTS, type CheckInCharacter, type CheckInInitial, type CheckInValues } from '@/lib/check-in';
import { DeviceIcon } from './device-icon';
import { RatingStars } from './rating-stars';

export type CheckInMode = 'new' | 'edit' | 'rewatch';

export type CheckInDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Called with the form values; the sheet closes immediately and the caller saves in the background. */
  onSubmit: (values: CheckInValues) => void;
  mode: CheckInMode;
  label: string;
  kind: 'episode' | 'movie';
  devices: Device[];
  services: Service[];
  characters: CheckInCharacter[];
  guestCharacters?: CheckInCharacter[];
  initial?: CheckInInitial | null;
  defaults?: { deviceId?: number | null; serviceId?: number | null };
  /** Cast and the previous check-in are still loading. */
  loading?: boolean;
};

const TITLES: Record<CheckInMode, string> = { new: 'How was it?', edit: 'Edit your check-in', rewatch: 'Log a rewatch' };

/**
 * TVTime-style check-in sheet. Everything here is optional and private: it
 * only ever feeds anonymous aggregate stats. The sheet is a pure form; the
 * watched state is saved by the caller, so the sheet never waits on the
 * network and closes the moment you save.
 */
export function CheckInDialog(props: CheckInDialogProps) {
  // Re-mount the form whenever its starting point changes (new target, prefill arrived).
  const formKey = `${props.label}:${props.mode}:${props.loading ? 'loading' : props.initial?.watchId ?? 'fresh'}`;
  const formId = useId();
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title={TITLES[props.mode]}
      description={props.label}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={props.onClose}>
            {props.mode === 'new' ? 'Skip' : 'Cancel'}
          </Button>
          <Button type="submit" form={formId} data-autofocus>
            {props.mode === 'edit' ? 'Save changes' : props.mode === 'rewatch' ? 'Log rewatch' : 'Save check-in'}
          </Button>
        </>
      }
    >
      {props.open ? <CheckInForm key={formKey} formId={formId} {...props} /> : null}
    </Dialog>
  );
}

function CheckInForm({ formId, onClose, onSubmit, mode, kind, devices, services, characters, guestCharacters = [], initial, defaults, loading }: CheckInDialogProps & { formId: string }) {
  const start = mode === 'edit' ? initial : null;
  const [deviceId, setDeviceId] = useState<number | null>(start ? (start.deviceId ?? null) : (defaults?.deviceId ?? null));
  const [deviceTouched, setDeviceTouched] = useState(false);
  const [serviceId, setServiceId] = useState<number | null>(start ? (start.serviceId ?? null) : (defaults?.serviceId ?? null));
  const [emotions, setEmotions] = useState<EmotionId[]>((start?.emotions ?? []) as EmotionId[]);
  const [characterId, setCharacterId] = useState<number | null>(start?.favoriteCharacterId ?? null);
  const [rating, setRating] = useState<number | null>(start?.rating ?? null);
  const [note, setNote] = useState(start?.note ?? '');
  const [showNote, setShowNote] = useState(Boolean(start?.note));

  const toggleEmotion = (id: EmotionId) => setEmotions((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));

  const pickService = (s: Service) => {
    const next = serviceId === s.id ? null : s.id;
    setServiceId(next);
    // Live TV implies a TV (and the cinema a cinema) unless a device was picked by hand.
    const hint = next ? SERVICE_DEVICE_HINTS[s.slug] : undefined;
    if (hint && !deviceTouched) {
      const d = devices.find((x) => x.slug === hint);
      if (d) setDeviceId(d.id);
    }
  };

  const submit = () => {
    onSubmit({ deviceId, serviceId, emotions, favoriteCharacterId: characterId, rating, note: note.trim() || null });
    onClose();
  };

  const allCharacters = [...guestCharacters.map((c) => ({ ...c, guest: true })), ...characters.filter((c) => !guestCharacters.some((g) => g.id === c.id)).map((c) => ({ ...c, guest: false }))];

  return (
    <form
      id={formId}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex flex-col gap-7 pb-2">
        <section>
          <h3 className="mb-3 text-sm font-semibold text-fg">Your rating</h3>
          <RatingStars value={rating} onChange={setRating} />
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-fg">How did you feel?</h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {EMOTIONS.map((e) => {
              const on = emotions.includes(e.id);
              return (
                <Tooltip key={e.id} content={e.description} className="w-full">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    transition={springs.snappy}
                    aria-pressed={on}
                    onClick={() => toggleEmotion(e.id)}
                    className={cn(
                      'flex w-full flex-col items-center gap-1.5 rounded-card border px-2 py-3 text-xs font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent/60',
                      on ? 'border-accent/60 bg-accent-soft text-fg' : 'border-border bg-surface-2 text-fg-muted hover:border-border-strong hover:text-fg',
                    )}
                  >
                    <motion.span key={String(on)} initial={on ? { scale: 0.5, rotate: -12 } : false} animate={{ scale: 1, rotate: 0 }} transition={springs.pop} className="text-2xl leading-none" aria-hidden>
                      {e.emoji}
                    </motion.span>
                    {e.label}
                  </motion.button>
                </Tooltip>
              );
            })}
          </div>
        </section>

        {loading ? (
          <section>
            <h3 className="mb-3 text-sm font-semibold text-fg">Favorite character</h3>
            <div className="flex gap-2">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-[104px] w-20 shrink-0" />
              ))}
            </div>
          </section>
        ) : allCharacters.length > 0 ? (
          <section>
            <h3 className="mb-1 text-sm font-semibold text-fg">Favorite character</h3>
            <p className="mb-3 text-xs text-fg-subtle">Who stole the {kind === 'episode' ? 'episode' : 'movie'}?</p>
            <ScrollRow label="characters" innerClassName="-mx-1 gap-2 px-1 pb-2">
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
                    className={cn('flex w-20 shrink-0 snap-start flex-col items-center gap-1.5 rounded-card border p-2 text-center outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent/60', on ? 'border-accent/60 bg-accent-soft' : 'border-border bg-surface-2 hover:border-border-strong')}
                  >
                    <span className={cn('size-14 overflow-hidden rounded-full bg-surface-3 ring-2 transition-[box-shadow,ring-color] duration-300', on ? 'ring-accent' : 'ring-transparent')}>
                      {src ? <img src={src} alt="" className="size-full object-cover" loading="lazy" /> : <span className="flex size-full items-center justify-center text-lg font-semibold text-fg-muted">{c.name[0]}</span>}
                    </span>
                    <span className="line-clamp-2 text-[11px] leading-tight font-medium text-fg">{c.name}</span>
                    {c.guest ? <span className="text-[9px] font-semibold tracking-wide text-accent uppercase">Guest</span> : null}
                  </motion.button>
                );
              })}
            </ScrollRow>
          </section>
        ) : null}

        <section className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-fg">Where did you watch?</h3>
            <div className="flex flex-wrap gap-2">
              {services.map((s) => (
                <Chip key={s.id} size="sm" selected={serviceId === s.id} onClick={() => pickService(s)}>
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
                <Chip
                  key={d.id}
                  size="sm"
                  selected={deviceId === d.id}
                  onClick={() => {
                    setDeviceTouched(true);
                    setDeviceId(deviceId === d.id ? null : d.id);
                  }}
                >
                  <DeviceIcon icon={d.icon} className="size-3.5" />
                  {d.name}
                </Chip>
              ))}
            </div>
          </div>
        </section>

        <section>
          {showNote ? (
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="A private note for future you…" maxLength={500} rows={3} autoFocus />
          ) : (
            <button type="button" onClick={() => setShowNote(true)} className="text-sm text-fg-muted transition-colors hover:text-fg">
              + Add a private note
            </button>
          )}
        </section>
        <p className="flex items-start gap-2 text-xs text-fg-subtle">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Your rating, device, service, feelings and favorite character are private. They only ever appear in anonymous totals.
        </p>
      </div>
    </form>
  );
}
