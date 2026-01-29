export const EXPAND_INTENT = '@web-intents/expand';
export const NAVIGATE_INTENT = '@web-intents/navigate';

/**
 * Signals that a user has triggered a header to reveal its content.
 * Dispatched when a user clicks or presses Enter/Space on a header.
 */
export interface ExpandIntent {
    /** The ID of the panel to expand/toggle */
    value: string | null;
}

/**
 * Signals a desire to move focus within the accordion set.
 * Abstracts directional keys (Arrow Up/Down, Home/End) into semantic navigation requests.
 */
export interface NavigateIntent {
    direction: 'previous' | 'next' | 'first' | 'last';
    orientation: 'vertical' | 'horizontal';
}
