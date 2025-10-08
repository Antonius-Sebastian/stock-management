/**
 * UI Preferences Cookie Management
 * Stores user preferences like sidebar state and column filters
 */

export type UIPreferences = {
  sidebarCollapsed: boolean;
  columnFilters?: Record<string, string[]>;
};

const COOKIE_NAME = 'ui-preferences';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

/**
 * Get UI preferences from cookies
 */
export function getUIPreferences(): UIPreferences {
  if (typeof document === 'undefined') {
    return { sidebarCollapsed: false };
  }

  const cookies = document.cookie.split(';');
  const preferenceCookie = cookies.find(c => c.trim().startsWith(`${COOKIE_NAME}=`));

  if (!preferenceCookie) {
    return { sidebarCollapsed: false };
  }

  try {
    const value = preferenceCookie.split('=')[1];
    const decoded = decodeURIComponent(value);
    return JSON.parse(decoded);
  } catch {
    return { sidebarCollapsed: false };
  }
}

/**
 * Save UI preferences to cookies
 */
export function saveUIPreferences(preferences: Partial<UIPreferences>) {
  if (typeof document === 'undefined') return;

  const current = getUIPreferences();
  const updated = { ...current, ...preferences };
  const encoded = encodeURIComponent(JSON.stringify(updated));

  document.cookie = `${COOKIE_NAME}=${encoded}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

/**
 * Get sidebar collapsed state from cookies
 */
export function getSidebarCollapsed(): boolean {
  return getUIPreferences().sidebarCollapsed;
}

/**
 * Save sidebar collapsed state to cookies
 */
export function saveSidebarCollapsed(collapsed: boolean) {
  saveUIPreferences({ sidebarCollapsed: collapsed });
}

/**
 * Get column filters from cookies for a specific table
 */
export function getColumnFilters(tableId: string): string[] {
  const prefs = getUIPreferences();
  return prefs.columnFilters?.[tableId] || [];
}

/**
 * Save column filters to cookies for a specific table
 */
export function saveColumnFilters(tableId: string, filters: string[]) {
  const current = getUIPreferences();
  const columnFilters = { ...current.columnFilters, [tableId]: filters };
  saveUIPreferences({ columnFilters });
}
