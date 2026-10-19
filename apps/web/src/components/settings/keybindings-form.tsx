'use client';

import { Button, Island, Kbd, cn, springs, useToast } from '@marutime/ui';
import { Keyboard, RotateCcw } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { updatePreferencesAction } from '@/actions/profile';
import { KeyCaps, useShortcuts } from '@/components/keyboard/shortcut-provider';
import { eventToCombo } from '@/lib/keys';
import { SHORTCUTS, SHORTCUT_GROUPS, resolveBindings } from '@/lib/shortcuts';

const DEFAULTS = Object.fromEntries(SHORTCUTS.map((s) => [s.id, s.keys]));
/** Keys that would break basic navigation if bound on their own. */
const RESERVED = new Set(['escape', 'tab', 'shift+tab', 'enter', 'space', 'arrowup', 'arrowdown', 'backspace']);

/**
 * Rebind any shortcut by pressing the new keys. Two keys pressed in quick
 * succession make a sequence ("g" then "h"). Saved to the account, so the
 * same shortcuts follow you to every browser.
 */
export function KeybindingsForm({ initial }: { initial: Record<string, string | null> }) {
  const ctx = useShortcuts();
  const { toast } = useToast();
  const [custom, setCustomState] = useState<Record<string, string | null>>(initial);
  const [recording, setRecording] = useState<string | null>(null);
  const [captured, setCaptured] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bindings = resolveBindings(custom);

  const save = async (next: Record<string, string | null>) => {
    // Only store what differs from the defaults.
    const diff = Object.fromEntries(Object.entries(next).filter(([id, v]) => DEFAULTS[id] !== v));
    setCustomState(diff);
    ctx?.setCustom(diff);
    const r = await updatePreferencesAction({ keybindings: diff });
    if (!r.ok) toast({ tone: 'error', title: 'Could not save your shortcuts', description: r.error });
  };

  useEffect(() => {
    if (!recording) return;
    ctx?.setRecording(true);
    let steps: string[] = [];
    const finish = (seq: string | null) => {
      if (timer.current) clearTimeout(timer.current);
      setRecording(null);
      setCaptured([]);
      if (!seq) return;
      if (RESERVED.has(seq)) {
        toast({ tone: 'warning', title: `${seq} cannot be a shortcut on its own` });
        return;
      }
      const next = { ...bindings, [recording]: seq };
      const clash = SHORTCUTS.find((s) => s.id !== recording && bindings[s.id] === seq);
      if (clash) {
        next[clash.id] = null;
        toast({ tone: 'info', title: 'Shortcut moved', description: `It no longer triggers “${clash.label}”.` });
      }
      void save(next);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape' && steps.length === 0) return finish(null);
      const combo = eventToCombo(e);
      if (!combo) return;
      steps = [...steps, combo].slice(0, 2);
      setCaptured(steps);
      if (timer.current) clearTimeout(timer.current);
      if (steps.length === 2 || combo.includes('+')) finish(steps.join(' '));
      else timer.current = setTimeout(() => finish(steps.join(' ')), 900);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      ctx?.setRecording(false);
      if (timer.current) clearTimeout(timer.current);
    };
    // bindings are read at the moment recording finishes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  const customised = Object.keys(custom).length > 0;

  return (
    <div className="flex flex-col gap-6">
      <Island>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-accent-soft text-accent">
              <Keyboard className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold text-fg">Keyboard shortcuts</h2>
              <p className="mt-0.5 max-w-xl text-sm text-fg-muted">
                Click <span className="font-medium text-fg">Change</span>, then press the new keys. Press two keys in a row for a sequence (like <Kbd>G</Kbd> then <Kbd>H</Kbd>). <Kbd>Esc</Kbd> cancels. Shortcuts never fire while you type in a text field.
              </p>
            </div>
          </div>
          {customised ? (
            <Button variant="secondary" size="sm" onClick={() => void save({ ...DEFAULTS })}>
              <RotateCcw className="size-4" /> Reset all
            </Button>
          ) : null}
        </div>
      </Island>
      {SHORTCUT_GROUPS.map((group) => (
        <Island key={group} padding="sm">
          <h3 className="px-2 pt-1 pb-2 text-xs font-semibold tracking-wide text-fg-subtle uppercase">{group}</h3>
          <ul className="flex flex-col">
            {SHORTCUTS.filter((s) => s.group === group).map((s) => {
              const current = bindings[s.id];
              const changed = s.id in custom;
              const active = recording === s.id;
              return (
                <li key={s.id} className={cn('flex flex-wrap items-center gap-3 rounded-control px-2 py-2 transition-colors duration-200', active && 'bg-accent-soft')}>
                  <span className="min-w-40 flex-1 text-sm text-fg">
                    {s.label}
                    {changed ? <span className="ml-2 text-[11px] font-medium text-accent">custom</span> : null}
                  </span>
                  <span className="flex min-w-28 justify-end">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {active ? (
                        <motion.span key="rec" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={springs.snappy} className="inline-flex items-center gap-1.5 text-xs font-medium text-accent">
                          <span className="size-2 animate-pulse rounded-full bg-accent" />
                          {captured.length ? <KeyCaps binding={captured.join(' ')} /> : 'Press keys…'}
                        </motion.span>
                      ) : current ? (
                        <motion.span key={current} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={springs.snappy}>
                          <KeyCaps binding={current} />
                        </motion.span>
                      ) : (
                        <motion.span key="off" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-fg-subtle">
                          Off
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                  <span className="flex items-center gap-1">
                    <Button variant={active ? 'accent-soft' : 'secondary'} size="xs" onClick={() => setRecording(active ? null : s.id)}>
                      {active ? 'Cancel' : 'Change'}
                    </Button>
                    {current ? (
                      <Button variant="ghost" size="xs" onClick={() => void save({ ...bindings, [s.id]: null })} tooltip="Turn this shortcut off">
                        Off
                      </Button>
                    ) : null}
                    {changed ? (
                      <Button variant="ghost" size="icon-sm" onClick={() => void save({ ...bindings, [s.id]: s.keys })} aria-label={`Reset ${s.label}`} tooltip="Back to the default">
                        <RotateCcw className="size-3.5" />
                      </Button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </Island>
      ))}
    </div>
  );
}
