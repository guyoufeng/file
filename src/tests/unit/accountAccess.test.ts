import { beforeEach, describe, expect, it } from "vitest";
import {
  authenticateAccount,
  canAccessModule,
  canModifyModule,
  createAccount,
  defaultAccountPermissions,
  getAccounts,
  getCurrentSession,
  logoutAccount,
  saveAccount,
  updateAccountPermissions,
} from "../../services/auth/accountAccess";

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

describe("account access control", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it("seeds admin and readonly accounts with different permissions", () => {
    const accounts = getAccounts();

    expect(accounts.find((account) => account.username === "admin")).toMatchObject({
      role: "admin",
    });
    expect(accounts.find((account) => account.username === "readonly")).toMatchObject({
      role: "viewer",
    });
    expect(canModifyModule(accounts[0], "settings")).toBe(true);
    expect(canAccessModule(accounts[0], "agent-traces")).toBe(true);
    expect(canModifyModule(accounts.find((account) => account.username === "readonly")!, "assets")).toBe(false);
    expect(canAccessModule(accounts.find((account) => account.username === "readonly")!, "agent-traces")).toBe(true);
  });

  it("authenticates active accounts and stores a session", () => {
    const result = authenticateAccount("admin", "admin123");

    expect(result.ok).toBe(true);
    expect(result.account?.username).toBe("admin");
    expect(getCurrentSession()?.username).toBe("admin");
  });

  it("rejects invalid password and disabled account", () => {
    expect(authenticateAccount("admin", "bad-password")).toMatchObject({
      ok: false,
    });

    const account = createAccount({
      username: "ops",
      displayName: "运维",
      password: "ops123",
      role: "operator",
      enabled: false,
      permissions: defaultAccountPermissions("viewer"),
    });

    expect(authenticateAccount(account.username, "ops123")).toMatchObject({
      ok: false,
    });
  });

  it("creates accounts and updates module permissions", () => {
    const account = createAccount({
      username: "ops",
      displayName: "运维账号",
      password: "ops123",
      role: "operator",
      enabled: true,
      permissions: defaultAccountPermissions("viewer"),
    });

    const updated = updateAccountPermissions(account.id, {
      assets: "write",
      settings: "none",
    });

    expect(canAccessModule(updated!, "assets")).toBe(true);
    expect(canModifyModule(updated!, "assets")).toBe(true);
    expect(canAccessModule(updated!, "settings")).toBe(false);
  });

  it("updates profile fields without losing permissions and can logout", () => {
    const account = getAccounts()[0];
    const saved = saveAccount({
      ...account,
      displayName: "系统管理员",
    });
    authenticateAccount("admin", "admin123");
    logoutAccount();

    expect(saved.displayName).toBe("系统管理员");
    expect(saved.permissions.settings).toBe("write");
    expect(getCurrentSession()).toBeNull();
  });
});
