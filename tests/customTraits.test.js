import test from 'node:test'
import assert from 'node:assert/strict'
import { appendCustomTrait, canCreateCustomTrait, isCustomTraitSetPath, traitSetAllowsCustomTraits } from '../module/actor/customTraits.js'
import { mergeActorTypeConfiguration } from '../module/actor/syncActorType.js'

test('legacy Trait Sets continue allowing owner-created custom Traits', () => {
  const traitSet = { id: '_legacy', settings: {} }

  assert.equal(traitSetAllowsCustomTraits(traitSet), true)
  assert.equal(canCreateCustomTrait(traitSet, { isEditable: true, isOwner: true }), true)
})

test('custom Trait creation respects ownership, editability, setting, and GM override', () => {
  const allowed = { settings: { allowCustomTraits: true } }
  const disallowed = { settings: { allowCustomTraits: false } }

  assert.equal(canCreateCustomTrait(allowed, { isEditable: true, isOwner: true }), true)
  assert.equal(canCreateCustomTrait(disallowed, { isEditable: true, isOwner: true }), false)
  assert.equal(canCreateCustomTrait(allowed, { isEditable: true, isOwner: false }), false)
  assert.equal(canCreateCustomTrait(allowed, { isEditable: false, isGM: true, isOwner: true }), false)
  assert.equal(canCreateCustomTrait(disallowed, { isEditable: true, isGM: true, isOwner: false }), true)
})

test('permitted creation appends exactly one custom Trait', () => {
  const existing = { 0: { id: '_existing', name: 'Existing' } }
  const added = appendCustomTrait(existing, { id: '_new', name: 'New Trait' })

  assert.equal(Object.keys(existing).length, 1)
  assert.equal(Object.keys(added).length, 2)
  assert.equal(added[0].name, 'Existing')
  assert.equal(added[1].name, 'New Trait')
})

test('only a direct Trait Set path can target custom Trait creation', () => {
  assert.equal(isCustomTraitSetPath('system.actorType.traitSets.0'), true)
  assert.equal(isCustomTraitSetPath('system.actorType.traitSets._stableId'), true)
  assert.equal(isCustomTraitSetPath('system.actorType.plotPoints'), false)
  assert.equal(isCustomTraitSetPath('system.pp'), false)
  assert.equal(isCustomTraitSetPath('system.actorType.assets'), false)
  assert.equal(isCustomTraitSetPath('system.actorType.traitSets.0.customTraits'), false)
})

test('Actor Type sync propagates the setting without deleting custom Traits', () => {
  const actorType = {
    id: '_type',
    traitSets: {
      0: {
        id: '_set',
        settings: { allowCustomTraits: true },
        customTraits: { 0: { id: '_custom', name: 'Keep Me' } }
      }
    }
  }
  const template = {
    id: '_type',
    traitSets: {
      0: { id: '_set', settings: { allowCustomTraits: false } }
    }
  }

  const disabled = mergeActorTypeConfiguration(actorType, template)
  assert.equal(disabled.traitSets[0].settings.allowCustomTraits, false)
  assert.equal(disabled.traitSets[0].customTraits[0].name, 'Keep Me')

  const enabled = mergeActorTypeConfiguration(disabled, {
    id: '_type',
    traitSets: { 0: { id: '_set', settings: { allowCustomTraits: true } } }
  })
  assert.equal(enabled.traitSets[0].settings.allowCustomTraits, true)
  assert.equal(enabled.traitSets[0].customTraits[0].name, 'Keep Me')
})
