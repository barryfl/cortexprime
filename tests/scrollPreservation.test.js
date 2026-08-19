import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { ScrollPreservation } from '../module/applications/scrollPreservation.js'

const rootWith = (selector, scrollTop = 0) => {
  const container = { scrollTop }
  return {
    container,
    root: {
      matches: () => false,
      querySelector: candidate => candidate === selector ? container : null
    }
  }
}

test('explicit preservation restores the prior position, including zero', () => {
  const state = new ScrollPreservation('.window-content')
  const before = rootWith('.window-content', 240)
  const after = rootWith('.window-content', 0)
  assert.equal(state.preserve(before.root), true)
  assert.equal(state.restore(after.root), true)
  assert.equal(after.container.scrollTop, 240)

  before.container.scrollTop = 0
  after.container.scrollTop = 99
  state.preserve(before.root)
  state.restore(after.root)
  assert.equal(after.container.scrollTop, 0)
})

test('without a preservation request render position is untouched', () => {
  const state = new ScrollPreservation()
  const rendered = rootWith('.window-content', 0)
  assert.equal(state.restore(rendered.root), false)
  assert.equal(rendered.container.scrollTop, 0)
})

test('application instances do not share state', () => {
  const first = new ScrollPreservation()
  const second = new ScrollPreservation()
  first.preserve(rootWith('.window-content', 120).root)
  const secondRender = rootWith('.window-content', 0)
  assert.equal(second.restore(secondRender.root), false)
  assert.equal(secondRender.container.scrollTop, 0)
})

test('clear prevents navigation from restoring stale state', () => {
  const state = new ScrollPreservation()
  state.preserve(rootWith('.window-content', 80).root)
  state.clear()
  const navigationRender = rootWith('.window-content', 0)
  assert.equal(state.restore(navigationRender.root), false)
  assert.equal(navigationRender.container.scrollTop, 0)
})

test('repeated same-view rerenders preserve the current position', () => {
  const state = new ScrollPreservation()
  let current = rootWith('.window-content', 70)
  state.preserve(current.root)
  current = rootWith('.window-content', 0)
  state.restore(current.root)
  current.container.scrollTop = 115
  state.preserve(current.root)
  const next = rootWith('.window-content', 0)
  state.restore(next.root)
  assert.equal(next.container.scrollTop, 115)
})

test('Actor Sheet and shared applications use their intended containers', () => {
  const actorSheet = fs.readFileSync(new URL('../module/actor/actor-sheet.js', import.meta.url), 'utf8')
  const base = fs.readFileSync(new URL('../module/applications/CortexPrimeApplication.js', import.meta.url), 'utf8')
  assert.match(actorSheet, /new ScrollPreservation\('\.sheet-body'\)/)
  assert.match(base, /new ScrollPreservation\('\.window-content'\)/)
})

test('representative same-view actions opt in and navigation opts out', () => {
  const actorSheet = fs.readFileSync(new URL('../module/actor/actor-sheet.js', import.meta.url), 'utf8')
  const actorSettings = fs.readFileSync(new URL('../module/settings/ActorSettings.js', import.meta.url), 'utf8')
  const themes = fs.readFileSync(new URL('../module/settings/ThemeSettings.js', import.meta.url), 'utf8')
  const dicePool = fs.readFileSync(new URL('../module/applications/UserDicePool.js', import.meta.url), 'utf8')
  const help = fs.readFileSync(new URL('../module/apps/CortexPrimeHelp.js', import.meta.url), 'utf8')

  assert.match(actorSheet, /async _saveForm[\s\S]*?_preserveSheetScroll\(\)/)
  assert.match(actorSheet, /async _changeResource[\s\S]*?_preserveSheetScroll\(\)/)
  assert.match(actorSheet, /_activeSheetTab[\s\S]*?_discardPreservedSheetScroll\(\)/)
  assert.match(actorSettings, /async _saveForm[\s\S]*?_preserveScroll\(\)/)
  assert.match(actorSettings, /async _breadcrumbChange[\s\S]*?_discardPreservedScroll\(\)/)
  assert.match(themes, /async _saveForm[\s\S]*?_preserveScroll\(\)/)
  assert.match(dicePool, /_onDieChange[\s\S]*?_renderPreservingScroll\(\)/)
  assert.match(help, /this\.templatePath[\s\S]*?_discardPreservedScroll\(\)/)
})
