import type { GlobalThemeOverrides } from 'naive-ui'

export const darkNaiveThemeOverrides: GlobalThemeOverrides = {
  common: {
    bodyColor: '#050A16',
    cardColor: '#111827',
    modalColor: '#111827',
    popoverColor: '#111827',
    primaryColor: '#0EA5E9',
    primaryColorHover: '#38BDF8',
    primaryColorPressed: '#0284C7',
    successColor: '#10B981',
    warningColor: '#F59E0B',
    errorColor: '#EF4444',
    borderColor: '#263247',
    textColorBase: '#E5EEFB',
  },
}

export const lightNaiveThemeOverrides: GlobalThemeOverrides = {
  common: {
    bodyColor: '#f4f7fb',
    cardColor: '#ffffff',
    modalColor: '#ffffff',
    popoverColor: '#ffffff',
    primaryColor: '#0284c7',
    primaryColorHover: '#0ea5e9',
    primaryColorPressed: '#0369a1',
    successColor: '#059669',
    warningColor: '#d97706',
    errorColor: '#dc2626',
    borderColor: '#d8e2ef',
    textColorBase: '#0f172a',
  },
}
