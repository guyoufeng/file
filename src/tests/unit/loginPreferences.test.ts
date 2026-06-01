import { beforeEach, describe, expect, it } from "vitest";
import {
  clearRememberedLogin,
  getRememberedLogin,
  saveRememberedLogin,
} from "../../services/auth/loginPreferences";

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

describe("login preferences", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it("stores remembered login only when explicitly enabled", () => {
    expect(getRememberedLogin()).toBeNull();

    saveRememberedLogin({ username: "admin", password: "admin123", remember: true });
    expect(getRememberedLogin()).toEqual({
      username: "admin",
      password: "admin123",
      remember: true,
    });

    clearRememberedLogin();
    expect(getRememberedLogin()).toBeNull();
  });
});
