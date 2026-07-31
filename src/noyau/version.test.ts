import { describe, it, expect } from 'vitest'
import { VERSION_TROIS } from './version.js'

describe('garde-fou de version', () => {
  it('épingle Three.js à la version mesurée dans les bancs', () => {
    expect(VERSION_TROIS).toBe('0.185.1')
  })
})
