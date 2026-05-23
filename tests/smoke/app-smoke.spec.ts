import { expect, test } from '@playwright/test'

test('starts the app and navigates through v0.1 core pages', async ({ page }) => {
  await page.goto('/#/rack-overview')

  await expect(page.getByRole('heading', { name: '机柜总览' })).toBeVisible()
  await expect(page.getByRole('button', { name: '529数据中心' })).toBeVisible()
  await expect(page.getByText('208')).toBeVisible()
  await expect(page.getByRole('button', { name: '系统展示' })).toBeVisible()
  await expect(page.getByTestId('current-user')).toHaveText('admin')
  await expect(page.getByTestId('app-clock')).toBeVisible()
  await expect(page.getByRole('button', { name: '打开 AI 助手' })).toBeVisible()
  await expect(page.getByText('南京 / 529数据中心')).toHaveCount(0)
  await expect(page.getByText('只读AI查询')).toHaveCount(0)

  await page.getByRole('button', { name: 'U位大图' }).click()
  const uView = page.getByTestId('rack-u-overview')
  await expect(uView.getByTestId('rack-u-row-A排').getByText('529-A1', { exact: true })).toBeVisible()
  await expect(uView.getByTestId('rack-u-row-A排').getByText('529-A10', { exact: true })).toBeVisible()
  await expect(uView.getByTestId('rack-u-row-B排').getByText('529-B1', { exact: true })).toBeVisible()
  await uView.getByTestId('rack-u-row-A排').getByRole('button', { name: /^529-A1\b/ }).click()
  await expect(page.getByTestId('rack-detail-floating-window')).toBeVisible()
  await expect(page.getByTestId('selected-rack-detail-title')).toHaveText('529-A1')
  await expect(page.locator('.overview-grid')).not.toHaveClass(/detail-open/)

  await page.getByRole('button', { name: '3D轻量视图' }).click()
  await expect(page.locator('canvas[aria-label="3D轻量机柜视图"]')).toBeVisible()

  await page.getByRole('link', { name: '告警中心' }).click()
  await expect(page.getByRole('heading', { name: '告警中心' })).toBeVisible()

  await page.getByRole('link', { name: '报表中心' }).click()
  await expect(page.getByRole('heading', { name: '报表中心' })).toBeVisible()

  await page.getByRole('link', { name: '系统设置' }).click()
  await expect(page.getByRole('heading', { name: '系统设置' })).toBeVisible()
})
