<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import ChervonLogo from "../../components/ChervonLogo.vue";
import { getFirstAccessiblePath } from "../../services/auth/accountAccess";
import { useAuthStore } from "../../stores/authStore";

const router = useRouter();
const authStore = useAuthStore();
const username = ref("admin");
const password = ref("");
const showPassword = ref(false);

async function login() {
  if (!authStore.login(username.value, password.value)) return;
  await router.replace(getFirstAccessiblePath(authStore.session));
}
</script>

<template>
  <main class="login-page">
    <section class="login-card" aria-label="账号登录">
      <ChervonLogo dark />
      <div class="login-title">
        <h1>泉峰AI数据中心管理平台</h1>
        <p>账号登录</p>
      </div>
      <form @submit.prevent="login">
        <label>
          <span>账号</span>
          <input v-model="username" type="text" autocomplete="username" aria-label="账号" />
        </label>
        <label>
          <span>密码</span>
          <div class="password-row">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              aria-label="密码"
            />
            <button type="button" @click="showPassword = !showPassword">
              {{ showPassword ? "隐藏" : "显示" }}
            </button>
          </div>
        </label>
        <p v-if="authStore.error" class="error-message">{{ authStore.error }}</p>
        <button type="submit" class="login-button">登录</button>
      </form>
      <footer>
        <span>默认管理员：admin / admin123</span>
        <span>只读账号：readonly / readonly123</span>
      </footer>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 40px;
  background:
    linear-gradient(90deg, rgba(114, 208, 95, 0.12), rgba(13, 148, 136, 0.05)),
    url("/brand/login-bg.jpg") center / cover no-repeat;
}

.login-card {
  width: min(410px, 92vw);
  display: grid;
  gap: 20px;
  padding: 42px 44px 34px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 28px 78px rgba(17, 60, 21, 0.22);
}

.login-title {
  display: grid;
  gap: 4px;
}

h1,
p {
  margin: 0;
}

h1 {
  color: #1f2937;
  font-size: 20px;
}

.login-title p,
footer {
  color: #64748b;
  font-size: 12px;
}

form {
  display: grid;
  gap: 14px;
}

label {
  display: grid;
  gap: 7px;
  color: #334155;
  font-size: 12px;
}

input {
  width: 100%;
  height: 44px;
  border: 1px solid #dbe5f2;
  border-radius: 2px;
  padding: 0 14px;
  color: #0f172a;
  background: #eaf2ff;
  outline: none;
}

input:focus {
  border-color: #9ac43a;
  box-shadow: 0 0 0 3px rgba(154, 196, 58, 0.18);
}

.password-row {
  position: relative;
}

.password-row input {
  padding-right: 64px;
}

.password-row button {
  position: absolute;
  right: 8px;
  top: 7px;
  height: 30px;
  border: 0;
  color: #64748b;
  background: transparent;
  cursor: pointer;
}

.error-message {
  color: #dc2626;
  font-size: 12px;
}

.login-button {
  height: 44px;
  border: 0;
  border-radius: 2px;
  color: #ffffff;
  background: #9ac43a;
  font-weight: 800;
  cursor: pointer;
}

footer {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
</style>
