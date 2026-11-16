export const SHORTCUT_ACTIONS = ['endDay', 'crew', 'book', 'journal', 'plan', 'hq', 'settings', 'home'] as const;
export type ShortcutAction = typeof SHORTCUT_ACTIONS[number];
export type ShortcutBindings = Record<ShortcutAction, string>;
export const SHORTCUT_LABELS: Record<ShortcutAction, string> = { endDay: 'Avslutt døgnet', crew: 'Mannskap', book: 'ZA-boka', journal: 'Feltjournal', plan: 'Dagsplan', hq: 'HQ / samfunn', settings: 'Innstillinger', home: 'Finn leiren' };
export const DEFAULT_SHORTCUT_BINDINGS: ShortcutBindings = { endDay: 'Space', crew: 'KeyC', book: 'KeyB', journal: 'KeyJ', plan: 'KeyP', hq: 'KeyH', settings: 'KeyI', home: 'Home' };
export function isShortcutCode(value: unknown): value is string { return typeof value === 'string' && /^(Key[A-Z]|Digit[0-9]|Space|Home|End)$/.test(value); }
const LEGACY_SHORTCUT_ACTIONS = SHORTCUT_ACTIONS.filter(action => action !== 'journal');
const JOURNAL_FALLBACK_CODES = ['KeyJ', 'KeyO', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => `Key${letter}`)];
/** Preserve a valid legacy map, including swaps. Only the new journal binding is filled.
 * J may already belong to an existing action: choose a stable free key without stealing it.
 * Invalid legacy bindings still use the previous all-map fallback behavior.
 */
export function normalizeShortcutBindings(value: unknown, fallback: ShortcutBindings = DEFAULT_SHORTCUT_BINDINGS): ShortcutBindings {
 const map = value && typeof value === 'object' ? value as Record<string, unknown> : {};
 const legacyCodes = LEGACY_SHORTCUT_ACTIONS.map(action => map[action]);
 if (!legacyCodes.every(isShortcutCode) || new Set(legacyCodes).size !== LEGACY_SHORTCUT_ACTIONS.length) return { ...fallback };
 const used = new Set(legacyCodes);
 const journal = isShortcutCode(map.journal) && !used.has(map.journal)
  ? map.journal
  : [fallback.journal, ...JOURNAL_FALLBACK_CODES].find(code => isShortcutCode(code) && !used.has(code))!;
 return Object.fromEntries(SHORTCUT_ACTIONS.map(action => [action, action === 'journal' ? journal : map[action]])) as ShortcutBindings;
}
export function displayShortcut(code: string): string { return code === 'Space' ? 'Mellomrom' : code.startsWith('Key') ? code.slice(3) : code.startsWith('Digit') ? code.slice(5) : code; }
export type ShortcutKeyboardEvent = Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>;
/** Caller owns focus, modal and repeat guards. Works for both keydown and keyup. */
export function actionForKeyboardEvent(event: ShortcutKeyboardEvent, bindings: ShortcutBindings): ShortcutAction | undefined {
 if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || !isShortcutCode(event.code)) return undefined;
 return SHORTCUT_ACTIONS.find(action => bindings[action] === event.code);
}
