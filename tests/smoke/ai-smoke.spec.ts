import { expect, test } from '@playwright/test'

test('opens AI assistant and answers a read-only asset location question', async ({ page }) => {
  await page.goto('/#/rack-overview')

  await page.getByRole('button', { name: 'AI 助手' }).click()
  await expect(page.getByRole('heading', { name: '只读智能查询' })).toBeVisible()

  await page.getByPlaceholder('例如：IP 为 10.10.3.25 的服务器在哪里？').fill('IP 为 10.10.0.21 的服务器在哪里？')
  await page.getByRole('button', { name: '发送查询' }).click()

  const drawer = page.locator('.ai-drawer')
  await expect(drawer.getByText('QF-SRV-001')).toBeVisible()
  await expect(drawer.getByText(/529数据中心/)).toBeVisible()
})
