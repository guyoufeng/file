export type AccountRole = "admin" | "operator" | "viewer";
export type PermissionLevel = "none" | "read" | "write";
export type AppModuleKey =
  | "rack-overview"
  | "assets"
  | "virtual-servers"
  | "access-records"
  | "change-management"
  | "connections"
  | "agent-traces"
  | "alerts"
  | "reports"
  | "settings";

export interface AccountPermissions extends Record<AppModuleKey, PermissionLevel> {}

export interface UserAccount {
  id: string;
  username: string;
  displayName: string;
  password: string;
  role: AccountRole;
  enabled: boolean;
  permissions: AccountPermissions;
  createdAt: string;
  updatedAt: string;
}

export interface AccountInput {
  username: string;
  displayName: string;
  password: string;
  role: AccountRole;
  enabled: boolean;
  permissions: AccountPermissions;
}

export interface AuthSession {
  accountId: string;
  username: string;
  displayName: string;
  role: AccountRole;
  permissions: AccountPermissions;
  signedInAt: string;
}

const ACCOUNT_KEY = "qf-ai-dcim.accounts";
const SESSION_KEY = "qf-ai-dcim.authSession";

export const appModules: Array<{ key: AppModuleKey; label: string; path: string }> = [
  { key: "rack-overview", label: "机柜总览", path: "/rack-overview" },
  { key: "assets", label: "资产管理", path: "/assets" },
  { key: "virtual-servers", label: "虚拟服务器", path: "/virtual-servers" },
  { key: "access-records", label: "进出管理", path: "/access-records" },
  { key: "change-management", label: "变更管理", path: "/changes" },
  { key: "connections", label: "连线管理", path: "/connections" },
  { key: "agent-traces", label: "Agent轨迹", path: "/agent-traces" },
  { key: "alerts", label: "告警中心", path: "/alerts" },
  { key: "reports", label: "报表中心", path: "/reports" },
  { key: "settings", label: "系统设置", path: "/settings" },
];

function storage() {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

function now() {
  return new Date().toISOString();
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function createId(username: string) {
  return `account-${normalizeUsername(username).replace(/[^a-z0-9]+/g, "-")}`;
}

export function defaultAccountPermissions(role: AccountRole): AccountPermissions {
  const level: PermissionLevel = role === "admin" ? "write" : "read";
  return {
    "rack-overview": level,
    assets: level,
    "virtual-servers": level,
    "access-records": level,
    "change-management": level,
    connections: level,
    "agent-traces": level,
    alerts: level,
    reports: level,
    settings: role === "admin" ? "write" : "none",
  };
}

function defaultAccounts(): UserAccount[] {
  const createdAt = now();
  return [
    {
      id: "account-admin",
      username: "admin",
      displayName: "系统管理员",
      password: "admin123",
      role: "admin",
      enabled: true,
      permissions: defaultAccountPermissions("admin"),
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "account-readonly",
      username: "readonly",
      displayName: "只读账号",
      password: "readonly123",
      role: "viewer",
      enabled: true,
      permissions: defaultAccountPermissions("viewer"),
      createdAt,
      updatedAt: createdAt,
    },
  ];
}

function readAccounts(): UserAccount[] {
  const raw = storage()?.getItem(ACCOUNT_KEY);
  if (!raw) {
    const seeded = defaultAccounts();
    writeAccounts(seeded);
    return seeded;
  }
  try {
    const parsed = JSON.parse(raw) as UserAccount[];
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed.map((account) => ({
          ...account,
          permissions: {
            ...defaultAccountPermissions(account.role),
            ...account.permissions,
          },
        }))
      : defaultAccounts();
  } catch {
    return defaultAccounts();
  }
}

function writeAccounts(accounts: UserAccount[]) {
  storage()?.setItem(ACCOUNT_KEY, JSON.stringify(accounts));
}

export function getAccounts() {
  return readAccounts();
}

export function saveAccount(account: UserAccount): UserAccount {
  const normalized = {
    ...account,
    username: normalizeUsername(account.username),
    updatedAt: now(),
  };
  writeAccounts([
    normalized,
    ...readAccounts().filter((item) => item.id !== account.id),
  ]);
  return normalized;
}

export function createAccount(input: AccountInput): UserAccount {
  const username = normalizeUsername(input.username);
  if (!username) throw new Error("账号名不能为空");
  if (!input.password.trim()) throw new Error("密码不能为空");
  const accounts = readAccounts();
  if (accounts.some((account) => account.username === username)) {
    throw new Error(`账号已存在：${username}`);
  }
  const timestamp = now();
  const account: UserAccount = {
    id: createId(username),
    username,
    displayName: input.displayName.trim() || username,
    password: input.password,
    role: input.role,
    enabled: input.enabled,
    permissions: input.permissions,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  writeAccounts([...accounts, account]);
  return account;
}

export function updateAccountPermissions(
  accountId: string,
  patch: Partial<AccountPermissions>,
): UserAccount | undefined {
  const account = readAccounts().find((item) => item.id === accountId);
  if (!account) return undefined;
  return saveAccount({
    ...account,
    permissions: {
      ...account.permissions,
      ...patch,
    },
  });
}

export function deleteAccount(accountId: string) {
  writeAccounts(readAccounts().filter((account) => account.id !== accountId));
}

function toSession(account: UserAccount): AuthSession {
  return {
    accountId: account.id,
    username: account.username,
    displayName: account.displayName,
    role: account.role,
    permissions: account.permissions,
    signedInAt: now(),
  };
}

export function authenticateAccount(username: string, password: string) {
  const account = readAccounts().find(
    (item) => item.username === normalizeUsername(username),
  );
  if (!account || account.password !== password) {
    return { ok: false as const, message: "账号或密码不正确。" };
  }
  if (!account.enabled) {
    return { ok: false as const, message: "账号已停用，请联系管理员。" };
  }
  const session = toSession(account);
  storage()?.setItem(SESSION_KEY, JSON.stringify(session));
  return { ok: true as const, message: "登录成功。", account, session };
}

export function getCurrentSession(): AuthSession | null {
  const raw = storage()?.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as AuthSession;
    return {
      ...session,
      permissions: {
        ...defaultAccountPermissions(session.role),
        ...session.permissions,
      },
    };
  } catch {
    storage()?.removeItem(SESSION_KEY);
    return null;
  }
}

export function logoutAccount() {
  storage()?.removeItem(SESSION_KEY);
}

export function canAccessModule(
  accountOrSession: Pick<AuthSession, "permissions"> | Pick<UserAccount, "permissions"> | undefined,
  moduleKey: AppModuleKey,
) {
  return (accountOrSession?.permissions[moduleKey] ?? "none") !== "none";
}

export function canModifyModule(
  accountOrSession: Pick<AuthSession, "permissions"> | Pick<UserAccount, "permissions"> | undefined,
  moduleKey: AppModuleKey,
) {
  return accountOrSession?.permissions[moduleKey] === "write";
}

export function getFirstAccessiblePath(session: AuthSession | null) {
  return appModules.find((module) => canAccessModule(session ?? undefined, module.key))?.path ?? "/login";
}
