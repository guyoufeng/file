import { expect, test } from '@playwright/test'

test('starts the app and navigates through v0.1 core pages', async ({ page }) => {
  await page.goto('/#/rack-overview')

  await expect(page.getByRole('heading', { name: '机柜总览' })).toBeVisible()
  await expect(page.getByRole('button', { name: '529数据中心' })).toBeVisible()
  await expect(page.getByText('208')).toBeVisible()
  await expect(page.getByRole('button', { name: '系统展示' })).toBeVisible()

  await page.getByRole('button', { name: 'U位大图' }).click()
  const uView = page.getByTestId('rack-u-overview')
  await expect(uView.getByText('529-A1', { exact: true })).toBeVisible()
  await expect(uView.getByText('529-A2', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '3D轻量视图' }).click()
  await expect(page.locator('canvas[aria-label="3D轻量机柜视图"]')).toBeVisible()

  await page.getByRole('link', { name: '告警中心' }).click()
  await expect(page.getByRole('heading', { name: '告警中心' })).toBeVisible()

  await page.getByRole('link', { name: '报表中心' }).click()
  await expect(page.getByRole('heading', { name: '报表中心' })).toBeVisible()

  await page.getByRole('link', { name: '系统设置' }).click()
  await expect(page.getByRole('heading', { name: '系统设置' })).toBeVisible()
})
