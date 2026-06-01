export interface RememberedLogin {
  username: string;
  password: string;
  remember: true;
}

const STORAGE_KEY = "qf-ai-dcim.rememberedLogin";

function storage() {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

export function getRememberedLogin(): RememberedLogin | null {
  const raw = storage()?.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RememberedLogin;
    if (!parsed.remember || !parsed.username) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveRememberedLogin(input: {
  username: string;
  password: string;
  remember: boolean;
}) {
  if (!input.remember) {
    clearRememberedLogin();
    return null;
  }
  const value: RememberedLogin = {
    username: input.username,
    password: input.password,
    remember: true,
  };
  storage()?.setItem(STORAGE_KEY, JSON.stringify(value));
  return value;
}

export function clearRememberedLogin() {
  storage()?.removeItem(STORAGE_KEY);
}
