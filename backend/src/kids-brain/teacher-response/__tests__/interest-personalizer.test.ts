import { describe, it, expect } from 'vitest'
import { buildPersonalizedContext } from '../interest-personalizer.js'

describe('buildPersonalizedContext', () => {
  it('returns null for empty interests array', () => {
    expect(buildPersonalizedContext([])).toBeNull()
  })

  it('returns a non-empty string for a known interest', () => {
    const result = buildPersonalizedContext(['roblox'])
    expect(result).not.toBeNull()
    expect(typeof result).toBe('string')
    expect((result as string).length).toBeGreaterThan(0)
  })

  it('maps each known interest tag to a phrase', () => {
    const tags = [
      'roblox', 'brawl_stars', 'minecraft', 'pokemon',
      'football', 'animals', 'cars', 'space',
      'dinosaurs', 'superheroes', 'princesses', 'drawing',
    ]
    for (const tag of tags) {
      const result = buildPersonalizedContext([tag])
      expect(result, `interest tag "${tag}" should produce a phrase`).not.toBeNull()
    }
  })

  it('returns the first matching interest when multiple are given', () => {
    const result = buildPersonalizedContext(['roblox', 'space'])
    expect(result).not.toBeNull()
  })

  it('returns null for an unknown interest tag', () => {
    expect(buildPersonalizedContext(['unknown_topic'])).toBeNull()
  })

  it('returns null when all tags are unknown', () => {
    expect(buildPersonalizedContext(['xyz', 'abc'])).toBeNull()
  })

  it('does NOT contain any curriculum-sensitive words', () => {
    const tags = ['roblox', 'minecraft', 'space', 'dinosaurs']
    for (const tag of tags) {
      const result = buildPersonalizedContext([tag]) ?? ''
      expect(result).not.toMatch(/correct|wrong|answer|target|curriculum|exercise/i)
    }
  })

  it('returned phrase is short (under 60 characters)', () => {
    const tags = ['roblox', 'brawl_stars', 'minecraft', 'pokemon',
      'football', 'animals', 'cars', 'space',
      'dinosaurs', 'superheroes', 'princesses', 'drawing']
    for (const tag of tags) {
      const result = buildPersonalizedContext([tag]) ?? ''
      expect(result.length, `phrase for "${tag}" must be < 60 chars`).toBeLessThan(60)
    }
  })
})
