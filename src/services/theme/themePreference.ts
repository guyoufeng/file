export type ThemePreference = "light" | "dark";

const STORAGE_KEY = "qf-ai-dcim.theme";

function storage() {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark";
}

export function getStoredThemePreference(): ThemePreference {
  const value = storage()?.getItem(STORAGE_KEY) ?? null;
  return isThemePreference(value) ? value : "light";
}

export function saveThemePreference(theme: ThemePreference): ThemePreference {
  storage()?.setItem(STORAGE_KEY, theme);
  return theme;
}

export function applyThemePreference(theme: ThemePreference): ThemePreference {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme;
  }
  return saveThemePreference(theme);
}
