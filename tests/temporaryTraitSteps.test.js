import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  changeTemporaryStep,
  collectAdjustedTraitPaths,
  getEffectiveTraitDice,
  prepareTemporaryDieView,
  stepDie
} from '../module/actor/temporaryTraitSteps.js'
import { normalizeActorType } from '../module/actor/normalizeActorType.js'
import { mergeActorTypeConfiguration } from '../module/actor/syncActorType.js'
import { resolveSavedPoolRecipe } from '../module/applications/dicePoolRecipes.js'
import { traitSuppressionKey, withTraitRestored, withTraitSuppressed } from '../module/actor/traitSuppression.js'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const dieTrait = (die = '8', temporaryStep) => ({
  id: '_craft',
  name: 'Craft',
  valueType: 'die',
  dice: { value: { 0: die } },
  ...(temporaryStep === undefined ? {} : { temporaryStep })
})

const actorType = traits => normalizeActorType({
  id: '_type',
  traitSets: { 0: { id: '_skills', settings: { hasDice: true }, traits } }
})

test('effective die uses the Cortex ladder and clamps at d4/d12', () => {
  assert.deepEqual(getEffectiveTraitDice(dieTrait('8')), { 0: '8' })
  assert.deepEqual(getEffectiveTraitDice(dieTrait('8', 1)), { 0: '10' })
  assert.deepEqual(getEffectiveTraitDice(dieTrait('8', -1)), { 0: '6' })
  assert.equal(stepDie('4', -4), '4')
  assert.equal(stepDie('12', 4), '12')
  assert.equal(changeTemporaryStep(dieTrait('4'), 'down'), 0)
  assert.equal(changeTemporaryStep(dieTrait('12'), 'up'), 0)
})

test('temporary view keeps base and effective dice separate and reset is zero', () => {
  const trait = dieTrait('8', 1)
  const view = prepareTemporaryDieView(trait)
  assert.deepEqual(view.baseDice, { 0: '8' })
  assert.deepEqual(view.effectiveDice, { 0: '10' })
  assert.equal(view.adjustmentLabel, '+1')
  assert.equal(changeTemporaryStep(trait, 'reset'), 0)
  assert.deepEqual(getEffectiveTraitDice({ ...trait, temporaryStep: 0 }), { 0: '8' })

  trait.dice.value[0] = '10'
  assert.equal(trait.temporaryStep, 1)
  assert.deepEqual(getEffectiveTraitDice(trait), { 0: '12' })
  assert.deepEqual(getEffectiveTraitDice({ ...trait, temporaryStep: changeTemporaryStep(trait, 'reset') }), { 0: '10' })
})

test('normalization supports preset, custom, and adapted legacy die Traits without mutating source', () => {
  const input = {
    id: '_type',
    simpleTraits: { 0: { id: '_legacy', label: 'Legacy', settings: { valueType: 'dice' }, dice: { value: { 0: '6' } }, temporaryStep: 1 } },
    traitSets: {
      0: {
        id: '_skills',
        settings: { hasDice: true },
        traits: { 0: dieTrait('8', 1) },
        customTraits: { 0: { ...dieTrait('10', -1), id: '_custom' } }
      }
    }
  }
  const before = structuredClone(input)
  const normalized = normalizeActorType(input)
  const legacy = Object.values(normalized.traitSets).find(set => set._compatibility).traits[0]

  assert.deepEqual(input, before)
  assert.equal(normalized.traitSets[0].traits[0]._temporaryDieView.effectiveDice[0], '10')
  assert.equal(normalized.traitSets[0].customTraits[0]._temporaryDieView.effectiveDice[0], '8')
  assert.equal(legacy._temporaryDieView.effectiveDice[0], '8')
})

test('number, text, and resource Traits are unaffected', () => {
  for (const trait of [
    { valueType: 'number', number: { value: 0 }, temporaryStep: 2 },
    { valueType: 'text', text: { value: '' }, temporaryStep: 2 },
    { valueType: 'resource', resource: { value: 0 }, temporaryStep: 2 }
  ]) assert.deepEqual(getEffectiveTraitDice(trait), {})
})

test('Actor Type refresh preserves preset and legacy temporary offsets and remains idempotent', () => {
  const actor = {
    id: '_type',
    simpleTraits: { 0: { id: '_legacy', settings: { valueType: 'dice' }, dice: { value: { 0: '6' } }, temporaryStep: -1 } },
    traitSets: { 0: { id: '_skills', traits: { 0: dieTrait('8', 1) } } }
  }
  const template = {
    id: '_type',
    simpleTraits: { 0: { id: '_legacy', settings: { valueType: 'dice' }, dice: { value: { 0: '10' } } } },
    traitSets: { 0: { id: '_skills', traits: { 0: { ...dieTrait('10'), name: 'Renamed' } } } }
  }
  const once = mergeActorTypeConfiguration(actor, template)
  const twice = mergeActorTypeConfiguration(once, template)
  assert.equal(once.traitSets[0].traits[0].temporaryStep, 1)
  assert.equal(once.simpleTraits[0].temporaryStep, -1)
  assert.deepEqual(twice, once)
})

test('suppression and restoration preserve base, false-y state, and temporary adjustment', () => {
  const type = actorType({ 0: dieTrait('8', 1) })
  const traitSet = type.traitSets[0]
  const trait = traitSet.traits[0]
  trait.shutdown = false
  const suppressionId = traitSuppressionKey(traitSet, trait)
  const suppressed = withTraitSuppressed({}, suppressionId)
  const restored = withTraitRestored(suppressed, suppressionId)

  assert.equal(suppressed[suppressionId], true)
  assert.deepEqual(restored, {})
  assert.equal(trait.dice.value[0], '8')
  assert.equal(trait.temporaryStep, 1)
  assert.equal(trait.shutdown, false)
})

test('collecting adjusted Traits supports a scene reset without touching other value types', () => {
  const normalized = actorType({
    0: dieTrait('8', 1),
    1: { ...dieTrait('10', -1), id: '_second' },
    2: { id: '_number', valueType: 'number', number: { value: 2 }, temporaryStep: 3 }
  })
  assert.deepEqual(collectAdjustedTraitPaths(normalized), [
    'system.actorType.traitSets.0.traits.0',
    'system.actorType.traitSets.0.traits.1'
  ])
  assert.equal(prepareTemporaryDieView(dieTrait('8', 0)).adjusted, false)
})

test('saved Trait recipes resolve the current effective die without recipe migration', async () => {
  const sourceActor = {
    uuid: 'Actor.hero',
    name: 'Hero',
    system: { actorType: actorType({ 0: dieTrait('8', 1) }) }
  }
  const recipe = {
    id: '_old-recipe',
    version: 1,
    entries: [{ type: 'actorTrait', actorUuid: sourceActor.uuid, traitSetId: '_skills', traitId: '_craft', label: 'Craft', source: 'Hero' }]
  }

  let resolved = await resolveSavedPoolRecipe(recipe, { resolveActor: async () => sourceActor })
  assert.equal(resolved.pool.Hero[0].value[0], '10')
  assert.equal(resolved.pool.Hero[0].provenance.type, 'actorTrait')

  sourceActor.system.actorType.traitSets[0].traits[0].temporaryStep = -1
  resolved = await resolveSavedPoolRecipe(recipe, { resolveActor: async () => sourceActor })
  assert.equal(resolved.pool.Hero[0].value[0], '6')
})

test('Actor Sheet gameplay paths use effective dice while permanent selectors remain base-valued', () => {
  const sheet = read('module/actor/actor-sheet.js')
  const traits = read('templates/partials/actor-sheet/traits.html')
  const controls = read('templates/partials/actor-sheet/temporary-die.html')

  assert.match(sheet, /trait \? getEffectiveTraitDice\(trait\)/)
  assert.match(traits, /dice=trait\.dice\.value/)
  assert.match(traits, /trait\._temporaryDieView\.effectiveDice/)
  assert.match(controls, /data-action="changeTemporaryDie"/)
  assert.match(controls, /data-direction="reset"/)
})
