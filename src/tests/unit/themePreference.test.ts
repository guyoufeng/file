import { beforeEach, describe, expect, it } from "vitest";
import {
  getStoredThemePreference,
  saveThemePreference,
} from "../../services/theme/themePreference";

function installLocalStorage() {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
    },
    configurable: true,
  });
}

describe("theme preference", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it("uses light theme by default and keeps dark as an option", () => {
    expect(getStoredThemePreference()).toBe("light");

    saveThemePreference("dark");

    expect(getStoredThemePreference()).toBe("dark");
  });
});
