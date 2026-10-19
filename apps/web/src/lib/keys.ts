/**
 * Key combos as strings: modifiers then key, joined by "+", e.g. "mod+k",
 * "shift+t", "?" or "arrowright". A sequence is combos separated by spaces,
 * e.g. "g h" (press g, then h). "mod" means ⌘ on Apple devices and Ctrl
 * elsewhere, so one binding works on every platform.
 */

const MODIFIERS = ['mod', 'ctrl', 'meta', 'alt', 'shift'] as const;

export function isApple(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? '';
  return /mac|iphone|ipad|ipod/i.test(platform);
}

const KEY_ALIASES: Record<string, string> = { ' ': 'space', esc: 'escape', left: 'arrowleft', right: 'arrowright', up: 'arrowup', down: 'arrowdown', del: 'delete', return: 'enter', plus: '+' };

function normalizeKey(key: string): string {
  const k = key.length === 1 ? key.toLowerCase() : key.toLowerCase();
  return KEY_ALIASES[k] ?? k;
}

/** Shifted symbols ("?", "!", ":") already encode the shift, so it is not listed. */
function isSymbol(key: string): boolean {
  return key.length === 1 && !/[a-z0-9]/.test(key);
}

/** The combo a keyboard event represents, or null for bare modifier presses. */
export function eventToCombo(e: KeyboardEvent): string | null {
  const key = normalizeKey(e.key);
  if (['shift', 'control', 'alt', 'meta', 'os', 'capslock', 'dead', 'unidentified'].includes(key)) return null;
  const apple = isApple();
  const parts: string[] = [];
  if (apple ? e.metaKey : e.ctrlKey) parts.push('mod');
  if (apple && e.ctrlKey) parts.push('ctrl');
  if (!apple && e.metaKey) parts.push('meta');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey && !isSymbol(key)) parts.push('shift');
  parts.push(key);
  return parts.join('+');
}

/** Canonical form of a typed binding ("Ctrl+K" → "mod+k" style ordering). */
export function normalizeCombo(combo: string): string {
  const tokens = combo.trim().toLowerCase().split('+').filter(Boolean);
  if (combo.trim().endsWith('++')) tokens.push('+');
  const key = normalizeKey(tokens.pop() ?? '');
  const mods = new Set(tokens.map((t) => (t === 'cmd' || t === 'command' ? 'mod' : t === 'control' ? 'ctrl' : t === 'option' ? 'alt' : t)));
  return [...MODIFIERS.filter((m) => mods.has(m) && !(m === 'shift' && isSymbol(key))), key].join('+');
}

export function normalizeSequence(sequence: string): string {
  return sequence.trim().split(/\s+/).map(normalizeCombo).join(' ');
}

const SYMBOLS: Record<string, string> = {
  arrowleft: '←',
  arrowright: '→',
  arrowup: '↑',
  arrowdown: '↓',
  enter: '↵',
  escape: 'Esc',
  space: 'Space',
  backspace: '⌫',
  delete: 'Del',
  tab: 'Tab',
};

/** Human labels for a combo, one per key cap: ["⌘", "K"] or ["Ctrl", "K"]. */
export function comboKeys(combo: string, apple = isApple()): string[] {
  return combo.split('+').map((t, i, all) => {
    if (i < all.length - 1 || all.length === 1) {
      if (t === 'mod') return apple ? '⌘' : 'Ctrl';
      if (t === 'ctrl') return apple ? '⌃' : 'Ctrl';
      if (t === 'meta') return apple ? '⌘' : 'Win';
      if (t === 'alt') return apple ? '⌥' : 'Alt';
      if (t === 'shift') return apple ? '⇧' : 'Shift';
    }
    return SYMBOLS[t] ?? (t.length === 1 ? t.toUpperCase() : t[0]!.toUpperCase() + t.slice(1));
  });
}

/** Key caps for a whole sequence, with "then" between steps: [["G"], ["H"]]. */
export function sequenceKeys(sequence: string, apple = isApple()): string[][] {
  return sequence
    .split(' ')
    .filter(Boolean)
    .map((c) => comboKeys(c, apple));
}

/** Whether a combo should fire while typing in a text field. */
export function worksInTextFields(combo: string): boolean {
  return combo.startsWith('mod+') || combo === 'escape';
}
