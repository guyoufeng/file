import { defineStore } from "pinia";
import {
  authenticateAccount,
  getCurrentSession,
  logoutAccount,
  type AuthSession,
} from "../services/auth/accountAccess";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    session: getCurrentSession() as AuthSession | null,
    error: "",
  }),
  actions: {
    login(username: string, password: string) {
      const result = authenticateAccount(username, password);
      if (!result.ok) {
        this.error = result.message;
        return false;
      }
      this.session = result.session;
      this.error = "";
      return true;
    },
    refresh() {
      this.session = getCurrentSession();
    },
    logout() {
      logoutAccount();
      this.session = null;
    },
  },
});
