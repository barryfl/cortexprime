import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { normalizeActorType } from '../module/actor/normalizeActorType.js'
import { mergeActorTypeConfiguration } from '../module/actor/syncActorType.js'
import {
  findSuppressibleTrait,
  prepareTraitSuppressions,
  traitSuppressionKey,
  withTraitRestored,
  withTraitSuppressed
} from '../module/actor/traitSuppression.js'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const traitSet = {
  id: '_set',
  label: 'Stress',
  settings: { hasDice: true },
  traits: {
    0: { id: '_die', name: 'Injured', valueType: 'die', dice: { value: { 0: '10' } } },
    1: { id: '_number', name: 'Charges', valueType: 'number', number: { value: 0 } },
    2: { id: '_text', name: 'Status', valueType: 'text', text: { value: '' } },
    3: { id: '_resource', name: 'Mana', valueType: 'resource', resource: { value: 0 }, valueSettings: { max: 5 } }
  },
  customTraits: { 0: { id: '_custom', name: 'Local', valueType: 'die', dice: { value: { 0: '8' } } } }
}

const actorType = () => ({ id: '_type', traitSets: { 0: structuredClone(traitSet) } })

test('suppression is a pure read-time filter and leaves custom Traits alone', () => {
  const source = actorType()
  const key = traitSuppressionKey(source.traitSets[0], source.traitSets[0].traits[0])
  source.suppressedTraits = withTraitSuppressed({}, key)
  const prepared = prepareTraitSuppressions(normalizeActorType(source))

  assert.equal(prepared.traitSets[0].traits[0], undefined)
  assert.equal(prepared.traitSets[0]._suppressedTraits[0].name, 'Injured')
  assert.equal(prepared.traitSets[0]._suppressedTraits[0].dice.value[0], '10')
  assert.equal(prepared.traitSets[0].customTraits[0].name, 'Local')
  assert.equal(source.traitSets[0].traits[0].name, 'Injured')
  assert.equal(findSuppressibleTrait(prepared, 'trait:_set:_custom'), null)

  const otherActor = prepareTraitSuppressions(normalizeActorType(actorType()))
  assert.equal(otherActor.traitSets[0].traits[0].name, 'Injured')
  assert.equal(otherActor.suppressedTraits, undefined)
})

test('restore removes only the marker and preserves false-y actor values', () => {
  const source = actorType()
  const keys = Object.values(source.traitSets[0].traits).map(trait => traitSuppressionKey(source.traitSets[0], trait))
  let suppression = Object.fromEntries(keys.map(key => [key, true]))
  suppression = withTraitRestored(suppression, keys[0])
  const prepared = prepareTraitSuppressions(normalizeActorType({ ...source, suppressedTraits: suppression }))

  assert.equal(prepared.traitSets[0].traits[0].dice.value[0], '10')
  assert.equal(prepared.traitSets[0]._suppressedTraits[1].number.value, 0)
  assert.equal(prepared.traitSets[0]._suppressedTraits[2].text.value, '')
  assert.equal(prepared.traitSets[0]._suppressedTraits[3].resource.value, 0)
})

test('stable IDs keep suppression through rename and reorder', () => {
  const source = actorType()
  const key = traitSuppressionKey(source.traitSets[0], source.traitSets[0].traits[0])
  const renamed = structuredClone(source)
  renamed.traitSets[0].label = 'Consequences'
  renamed.traitSets[0].traits = {
    0: renamed.traitSets[0].traits[1],
    1: { ...renamed.traitSets[0].traits[0], name: 'Seriously Injured' }
  }
  const prepared = prepareTraitSuppressions(normalizeActorType({ ...renamed, suppressedTraits: { [key]: true } }))

  assert.equal(prepared.traitSets[0]._suppressedTraits[1].name, 'Seriously Injured')
  assert.equal(prepared.traitSets[0].traits[0].id, '_number')
})

test('sync updates configuration and values while retaining actor-local suppression', () => {
  const actor = actorType()
  const key = traitSuppressionKey(actor.traitSets[0], actor.traitSets[0].traits[3])
  actor.suppressedTraits = { [key]: true, 'trait:_stale:_gone': true }
  const template = actorType()
  template.traitSets[0].traits[3] = {
    ...template.traitSets[0].traits[3],
    name: 'Arcane Power',
    valueSettings: { min: 0, max: 12, step: 2 }
  }
  template.traitSets[0].traits[3].resource.value = 5

  const once = mergeActorTypeConfiguration(actor, template)
  const twice = mergeActorTypeConfiguration(once, template)
  assert.deepEqual(once.suppressedTraits, actor.suppressedTraits)
  assert.equal(template.suppressedTraits, undefined)
  assert.equal(once.traitSets[0].traits[3].name, 'Arcane Power')
  assert.deepEqual(once.traitSets[0].traits[3].valueSettings, template.traitSets[0].traits[3].valueSettings)
  assert.equal(once.traitSets[0].traits[3].resource.value, 0)
  assert.deepEqual(twice, once)
  assert.equal(prepareTraitSuppressions(normalizeActorType(once)).traitSets[0].traits[3], undefined)
})

test('removed and later-returning template Traits retain suppression and actor state', () => {
  const actor = actorType()
  const key = traitSuppressionKey(actor.traitSets[0], actor.traitSets[0].traits[0])
  actor.suppressedTraits = { [key]: true }
  const removedTemplate = actorType()
  delete removedTemplate.traitSets[0].traits[0]

  const retained = mergeActorTypeConfiguration(actor, removedTemplate)
  assert.equal(Object.values(retained.traitSets[0].traits).some(trait => trait.id === '_die'), true)
  assert.equal(retained.suppressedTraits[key], true)

  const returned = mergeActorTypeConfiguration(retained, actorType())
  assert.equal(returned.suppressedTraits[key], true)
  assert.equal(Object.values(returned.traitSets[0].traits).find(trait => trait.id === '_die').dice.value[0], '10')
})

test('legacy Simple Traits use deterministic adapter IDs; unsafe missing ordinary IDs do not', () => {
  const legacy = normalizeActorType({
    id: '_legacy',
    simpleTraits: { 0: { label: 'Biography', settings: { valueType: 'text' }, text: { value: '' } } }
  })
  const legacySet = Object.values(legacy.traitSets).find(set => set._compatibility)
  const legacyTrait = legacySet.traits[0]
  const key = traitSuppressionKey(legacySet, legacyTrait)
  assert.equal(typeof key, 'string')
  assert.equal(prepareTraitSuppressions({ ...legacy, suppressedTraits: { [key]: true } }).traitSets.__legacySimpleTraits.traits[0], undefined)

  const missingId = normalizeActorType({ id: '_old', traitSets: { 0: { id: '_set', traits: { 0: { name: 'No ID' } } } } })
  assert.equal(traitSuppressionKey(missingId.traitSets[0], missingId.traitSets[0].traits[0]), null)
  assert.equal(prepareTraitSuppressions({ ...missingId, suppressedTraits: { 'trait:_stale:_gone': true } }).traitSets[0].traits[0].name, 'No ID')
})

test('Actor Sheet uses distinct suppress, restore, and custom deletion actions', () => {
  const editTraits = read('templates/partials/actor-sheet/traits-edit.html')
  const editSet = read('templates/partials/actor-sheet/trait-set-edit.html')
  const visibleTraits = read('templates/partials/actor-sheet/traits.html')
  const hiddenTraits = read('templates/partials/actor-sheet/suppressed-traits.html')
  assert.match(editTraits, /#if \(and \.\.\/custom \.\.\/editable\)[\s\S]*remove-button\.html/)
  assert.match(editTraits, /else if \(and \.\.\/editable trait\._suppressionId\)[\s\S]*data-action="suppressTrait"/)
  assert.match(editSet, /traitSet\._suppressedTraits/)
  assert.match(visibleTraits, /not \.\.\/custom[\s\S]*data-action="suppressTrait"/)
  assert.match(hiddenTraits, /data-action="restoreTrait"/)
})
