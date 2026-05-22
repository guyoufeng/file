import { describe, expect, it } from 'vitest'
import { toErrorMessage } from '../../services/backend/invoke'

describe('backend invoke helpers', () => {
  it('normalizes unknown errors into readable messages', () => {
    expect(toErrorMessage(new Error('连接失败'))).toBe('连接失败')
    expect(toErrorMessage('数据库未初始化')).toBe('数据库未初始化')
    expect(toErrorMessage({ message: '命令执行失败' })).toBe('命令执行失败')
  })
})
