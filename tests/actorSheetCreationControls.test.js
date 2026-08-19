import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Plot Points exposes only Plot Point actions', () => {
  const plotPoints = read('templates/partials/pp.html')

  assert.match(plotPoints, /data-action="addPp"/)
  assert.match(plotPoints, /data-action="spendPp"/)
  assert.doesNotMatch(plotPoints, /data-action="addTrait"/)
})

test('Trait Sets retain permission-gated custom Trait creation', () => {
  const traitSets = read('templates/partials/actor-sheet/trait-sets.html')

  assert.match(traitSets, /traitSet\._canCreateCustomTraits/)
  assert.match(traitSets, /data-action="addTrait"/)
})

test('specialized dynamic sections retain their creation actions', () => {
  const temporaryTraits = read('templates/partials/actor-sheet/temporary-traits.html')
  const actorSheet = read('templates/actor/actor-sheet.html')

  assert.match(temporaryTraits, /data-action="addAsset"/)
  assert.match(temporaryTraits, /data-action="addComplication"/)
  assert.match(actorSheet, /data-action="addNote"/)
})
