export const SHORTCUT_ACTIONS = ['endDay', 'crew', 'book', 'plan', 'hq', 'settings', 'home'] as const;
export type ShortcutAction = typeof SHORTCUT_ACTIONS[number];
export type ShortcutBindings = Record<ShortcutAction, string>;
export const SHORTCUT_LABELS: Record<ShortcutAction, string> = { endDay: 'Avslutt døgnet', crew: 'Mannskap', book: 'ZA-boka', plan: 'Dagsplan', hq: 'HQ / samfunn', settings: 'Innstillinger', home: 'Finn leiren' };
export const DEFAULT_SHORTCUT_BINDINGS: ShortcutBindings = { endDay: 'Space', crew: 'KeyC', book: 'KeyB', plan: 'KeyP', hq: 'KeyH', settings: 'KeyI', home: 'Home' };
export function isShortcutCode(value: unknown): value is string { return typeof value === 'string' && /^(Key[A-Z]|Digit[0-9]|Space|Home|End)$/.test(value); }
/** Invalid or colliding maps fall back as a unit, preserving valid key swaps. */
export function normalizeShortcutBindings(value: unknown, fallback: ShortcutBindings = DEFAULT_SHORTCUT_BINDINGS): ShortcutBindings {
 const map = value && typeof value === 'object' ? value as Record<string, unknown> : {};
 const codes = SHORTCUT_ACTIONS.map(action => map[action]);
 return codes.every(isShortcutCode) && new Set(codes).size === SHORTCUT_ACTIONS.length ? Object.fromEntries(SHORTCUT_ACTIONS.map(action => [action, map[action]])) as ShortcutBindings : { ...fallback };
}
export function displayShortcut(code: string): string { return code === 'Space' ? 'Mellomrom' : code.startsWith('Key') ? code.slice(3) : code.startsWith('Digit') ? code.slice(5) : code; }
export type ShortcutKeyboardEvent = Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>;
/** Caller owns focus, modal and repeat guards. Works for both keydown and keyup. */
export function actionForKeyboardEvent(event: ShortcutKeyboardEvent, bindings: ShortcutBindings): ShortcutAction | undefined {
 if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || !isShortcutCode(event.code)) return undefined;
 return SHORTCUT_ACTIONS.find(action => bindings[action] === event.code);
}
