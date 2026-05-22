import { expect, test } from '@playwright/test'

test('starts the app and navigates through v0.1 core pages', async ({ page }) => {
  await page.goto('/#/rack-overview')

  await expect(page.getByRole('heading', { name: '机柜总览' })).toBeVisible()
  await expect(page.getByRole('button', { name: '529数据中心' })).toBeVisible()
  await expect(page.getByText('208')).toBeVisible()

  await page.getByRole('button', { name: '3D轻量视图' }).click()
  await expect(page.locator('canvas[aria-label="3D轻量机柜视图"]')).toBeVisible()

  await page.getByRole('link', { name: '告警中心' }).click()
  await expect(page.getByRole('heading', { name: '告警中心' })).toBeVisible()

  await page.getByRole('link', { name: '报表中心' }).click()
  await expect(page.getByRole('heading', { name: '报表中心' })).toBeVisible()

  await page.getByRole('link', { name: '系统设置' }).click()
  await expect(page.getByRole('heading', { name: '系统设置' })).toBeVisible()
})
