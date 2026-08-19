import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeActorTypeSettings, normalizeActorType } from '../module/actor/normalizeActorType.js'

test('normalizes legacy simple traits without mutating input', () => {
  const input = {
    id: '_legacy',
    sectionLayout: { simpleTraits: { order: 4, tabId: '_tab', width: 'half' } },
    simpleTraits: {
      0: { label: 'Text', settings: { valueType: 'text' }, text: { value: 'hello' }, hidden: true, edit: true },
      1: { label: 'Zero', settings: { valueType: 'number', hasMaxNumber: false }, number: { value: 0 } },
      2: { label: 'Max', settings: { valueType: 'number', hasMaxNumber: true }, number: { value: 0, max: 10 } },
      3: { label: 'Pool A', settings: { valueType: 'dice', consumableDice: true }, dice: { value: { 0: '6' } } },
      4: { label: 'Pool B', settings: { valueType: 'dice', diceConsumable: true }, dice: { id: '_dice-id', value: { 0: '8' } } }
    },
    traitSets: {
      0: { id: '_set', settings: {}, traits: { 0: { id: '_trait', name: 'Normal', dice: { value: { 0: '8' } } } } }
    }
  }
  const before = structuredClone(input)
  const normalized = normalizeActorType(input)
  const legacySet = Object.values(normalized.traitSets).find(traitSet => traitSet._compatibility)

  assert.deepEqual(input, before)
  assert.equal(normalized.traitSets[0].traits[0].valueType, 'die')
  assert.deepEqual(Object.values(legacySet.traits).map(trait => trait.valueType), ['text', 'number', 'number', 'die', 'die'])
  assert.equal(legacySet.traits[1].number.value, 0)
  assert.equal(legacySet.traits[2].number.max, 10)
  assert.equal(legacySet.traits[3].valueSettings.consumableDice, true)
  assert.equal(legacySet.traits[4].valueSettings.consumableDice, true)
  assert.equal(legacySet.traits[0].hidden, true)
  assert.equal(legacySet.traits[0].edit, true)
  assert.match(legacySet.traits[0].id, /^legacy-simple-trait:/)
  assert.equal(normalized.sectionLayout[legacySet.id].tabId, '_tab')
  assert.equal(normalized.sectionLayout[legacySet.id].width, 'half')
})

test('supports mixed legacy and unified data', () => {
  const normalized = normalizeActorType({
    id: '_mixed',
    simpleTraits: { 0: { id: '_legacy-trait', label: 'Legacy', settings: { valueType: 'text' }, text: { value: 'ok' } } },
    traitSets: { 0: { id: '_set', settings: {}, traits: { 0: { id: '_typed', name: 'Typed', valueType: 'number', number: { value: 2 } } } } }
  })

  assert.equal(normalized.traitSets[0].traits[0].valueType, 'number')
  assert.equal(Object.values(normalized.traitSets).filter(traitSet => traitSet._compatibility).length, 1)
})

test('preserves raw legacy representation for import/export', () => {
  const imported = {
    id: '_imported',
    simpleTraits: { 0: { label: 'Legacy', settings: { valueType: 'dice', diceConsumable: true }, dice: { value: { 0: '6' } } } },
    traitSets: {}
  }
  const serialized = JSON.stringify(imported)

  normalizeActorType(imported)

  assert.equal(JSON.stringify(imported), serialized)
})

test('refreshes configuration while retaining actor-local typed and legacy values', () => {
  const actorData = {
    id: '_actor-type',
    simpleTraits: {
      old: {
        label: 'Old Legacy Label',
        settings: { valueType: 'number', hasMaxNumber: true },
        number: { value: 0, max: 12 },
        description: 'Actor description',
        hidden: true,
        edit: true
      }
    },
    traitSets: {
      local: {
        id: '_set',
        label: 'Old Set',
        traits: {
          localTrait: { id: '_trait', name: 'Old Name', valueType: 'number', number: { value: 0, max: 8 }, description: 'Local trait' }
        }
      }
    }
  }
  const settings = {
    id: '_actor-type',
    simpleTraits: {
      old: {
        label: 'Legacy Label',
        settings: { valueType: 'number', hasMaxNumber: true },
        number: { value: 4, max: 10 },
        hasDescription: true
      }
    },
    traitSets: {
      configured: {
        id: '_set',
        label: 'Set Label',
        settings: { hasDice: false },
        traits: {
          configuredTrait: { id: '_trait', name: 'Trait Name', valueType: 'number', valueSettings: { hasMaxNumber: true }, number: { value: 3, max: 6 } }
        }
      }
    }
  }

  const merged = mergeActorTypeSettings(actorData, settings)

  assert.equal(merged.simpleTraits.old.number.value, 0)
  assert.equal(merged.simpleTraits.old.number.max, 12)
  assert.equal(merged.simpleTraits.old.label, 'Legacy Label')
  assert.equal(merged.simpleTraits.old.hidden, true)
  assert.equal(merged.simpleTraits.old.edit, true)
  assert.equal(merged.traitSets.configured.traits.configuredTrait.number.value, 0)
  assert.equal(merged.traitSets.configured.traits.configuredTrait.number.max, 8)
  assert.equal(merged.traitSets.configured.traits.configuredTrait.name, 'Trait Name')
  assert.equal(merged.traitSets.configured.traits.configuredTrait.description, 'Local trait')
})
