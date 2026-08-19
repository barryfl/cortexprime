import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  createActorTraitProvenance,
  createSavedPoolMacroData,
  createSavedPoolRecipe,
  resolveSavedPoolRecipe
} from '../module/applications/dicePoolRecipes.js'
import { resetUserDicePool } from '../module/applications/dicePoolLifecycle.js'
import { mergeActorTypeConfiguration } from '../module/actor/syncActorType.js'
import { traitSuppressionKey } from '../module/actor/traitSuppression.js'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const actor = (uuid, name, die = '8') => ({
  uuid,
  name,
  system: {
    actorType: {
      id: '_type',
      traitSets: {
        0: {
          id: '_skills',
          label: 'Skills',
          settings: { hasDice: true },
          traits: {
            0: { id: '_craft', name: 'Craft', valueType: 'die', dice: { value: { 0: die } } },
            1: { id: '_lore', name: 'Lore', valueType: 'die', dice: { value: { 0: '6' } } }
          },
          customTraits: {
            0: { id: '_custom', name: 'Improvised', valueType: 'die', dice: { value: { 0: '10' } } }
          }
        }
      }
    }
  }
})

const actorEntry = (sourceActor, traitId = '_craft') => ({
  label: traitId === '_craft' ? 'Craft' : 'Lore',
  provenance: {
    type: 'actorTrait',
    actorUuid: sourceActor.uuid,
    traitId,
    traitSetId: '_skills'
  },
  value: { 0: traitId === '_craft' ? '8' : '6' }
})

test('Actor Sheet provenance resolves stable preset and custom Trait IDs', () => {
  const sourceActor = actor('Actor.hero', 'Hero')
  assert.deepEqual(
    createActorTraitProvenance(sourceActor, 'system.actorType.traitSets.0.traits.0.dice'),
    { type: 'actorTrait', actorUuid: 'Actor.hero', traitId: '_craft', traitSetId: '_skills' }
  )
  assert.deepEqual(
    createActorTraitProvenance(sourceActor, 'system.actorType.traitSets.0.customTraits.0.dice'),
    { type: 'actorTrait', actorUuid: 'Actor.hero', traitId: '_custom', traitSetId: '_skills' }
  )
  assert.equal(createActorTraitProvenance(sourceActor, 'system.actorType.assets.0.dice'), null)
})

test('export creates an ordered mixed dynamic/literal saved recipe', () => {
  const hero = actor('Actor.hero', 'Hero')
  const pool = {
    Hero: { 0: actorEntry(hero) },
    Custom: { 0: { label: 'Bonus', value: { 0: '6' } } }
  }
  const recipe = createSavedPoolRecipe(pool, { id: '_saved', name: 'Craft Something' })

  assert.equal(recipe.id, '_saved')
  assert.equal(recipe.entries[0].type, 'actorTrait')
  assert.equal(recipe.entries[0].traitId, '_craft')
  assert.equal(recipe.entries[0].value, undefined)
  assert.deepEqual(recipe.entries[1], { type: 'literal', label: 'Bonus', source: 'Custom', value: { 0: '6' } })
})

test('generated Macro is a thin launcher with no frozen Trait dice', () => {
  const data = createSavedPoolMacroData('Craft Something', '_saved', 'user1')
  assert.equal(data.type, 'script')
  assert.equal(data.command, 'return game.cortexprime.loadSavedPool("_saved");')
  assert.doesNotMatch(data.command, /d8|Craft|traitSets/)
  assert.deepEqual(data.ownership, { user1: 3 })
})

test('execution resolves current values and survives rename, reorder, and Actor Type sync', async () => {
  const hero = actor('Actor.hero', 'Hero', '8')
  const recipe = createSavedPoolRecipe({ Hero: { 0: actorEntry(hero) } }, { id: '_saved', name: 'Craft' })
  hero.system.actorType.traitSets[0].traits = {
    0: hero.system.actorType.traitSets[0].traits[1],
    1: { ...hero.system.actorType.traitSets[0].traits[0], name: 'Master Craftsman', dice: { value: { 0: '10' } } }
  }
  hero.system.actorType = mergeActorTypeConfiguration(hero.system.actorType, {
    id: '_type',
    traitSets: { 0: { id: '_skills', settings: { hasDice: true }, traits: { 0: { id: '_craft', name: 'Master Craftsman', valueType: 'die', dice: { value: { 0: '6' } } } } } }
  })

  const resolved = await resolveSavedPoolRecipe(recipe, { resolveActor: async () => hero })
  assert.deepEqual(resolved.unavailable, [])
  assert.equal(resolved.pool.Hero[0].label, 'Master Craftsman')
  assert.equal(resolved.pool.Hero[0].value[0], '10')
  assert.equal(resolved.pool.Hero[0].provenance.traitId, '_craft')
})

test('mixed recipes support multiple Actors and preserve literals', async () => {
  const hero = actor('Actor.hero', 'Hero', '10')
  const rival = actor('Actor.rival', 'Rival', '12')
  const recipe = createSavedPoolRecipe({
    Hero: { 0: actorEntry(hero) },
    Rival: { 0: actorEntry(rival) },
    Situation: { 0: { label: 'Fog', value: { 0: '6' } } }
  }, { id: '_mixed', name: 'Mixed' })
  const actors = { [hero.uuid]: hero, [rival.uuid]: rival }
  const { pool } = await resolveSavedPoolRecipe(recipe, { resolveActor: async uuid => actors[uuid] })

  assert.equal(pool.Hero[0].value[0], '10')
  assert.equal(pool.Rival[0].value[0], '12')
  assert.deepEqual(pool.Situation[0], { label: 'Fog', value: { 0: '6' } })
})

test('missing Actors, missing Traits, and suppressed Traits are skipped gracefully', async () => {
  const hero = actor('Actor.hero', 'Hero')
  const missingActor = actor('Actor.missing', 'Missing')
  const recipe = createSavedPoolRecipe({
    Hero: { 0: actorEntry(hero), 1: actorEntry(hero, '_gone') },
    Missing: { 0: actorEntry(missingActor) },
    Literal: { 0: { label: 'Keep', value: { 0: '6' } } }
  }, { id: '_saved', name: 'Partial' })
  const key = traitSuppressionKey(hero.system.actorType.traitSets[0], hero.system.actorType.traitSets[0].traits[0])
  hero.system.actorType.suppressedTraits = { [key]: true }

  const suppressed = await resolveSavedPoolRecipe(recipe, { resolveActor: async uuid => uuid === hero.uuid ? hero : null })
  assert.deepEqual(suppressed.pool, { Literal: { 0: { label: 'Keep', value: { 0: '6' } } } })
  assert.equal(suppressed.unavailable.length, 3)

  delete hero.system.actorType.suppressedTraits[key]
  const restored = await resolveSavedPoolRecipe(recipe, { resolveActor: async uuid => uuid === hero.uuid ? hero : null })
  assert.equal(restored.pool.Hero[0].value[0], '8')
})

test('a completely invalid recipe resolves empty and reconstructed provenance can be re-exported', async () => {
  const hero = actor('Actor.hero', 'Hero')
  const invalid = { id: '_bad', name: 'Bad', entries: [{ ...actorEntry(hero).provenance, label: 'Gone', source: 'Hero' }] }
  const empty = await resolveSavedPoolRecipe(invalid, { resolveActor: async () => null })
  assert.deepEqual(empty.pool, {})

  const valid = createSavedPoolRecipe({ Hero: { 0: actorEntry(hero) } }, { id: '_one', name: 'One' })
  const reconstructed = await resolveSavedPoolRecipe(valid, { resolveActor: async () => hero })
  const reexported = createSavedPoolRecipe(reconstructed.pool, { id: '_two', name: 'Two' })
  assert.equal(reexported.entries[0].type, 'actorTrait')
  assert.equal(reexported.entries[0].traitId, '_craft')
  assert.equal(reexported.entries[0].value, undefined)
})

test('transient Dice Pool reset does not alter saved recipes', async () => {
  const flags = { savedPools: { _saved: { id: '_saved', name: 'Keep' } }, dicePool: { pool: { old: true } } }
  const user = {
    async setFlag (scope, key, value) { flags[key] = value }
  }
  await resetUserDicePool(user)
  assert.deepEqual(flags.savedPools, { _saved: { id: '_saved', name: 'Keep' } })
  assert.deepEqual(flags.dicePool, { customAdd: { label: '', value: { 0: '8' } }, pool: {} })
})

test('UI and system API export, reconstruct, open, and never auto-roll', () => {
  const application = read('module/applications/UserDicePool.js')
  const hooks = read('module/cortexPrimeHooks.js')
  const template = read('templates/dice-pool.html')

  assert.match(template, /data-action="exportMacro"/)
  assert.match(application, /Macro\.create\(createSavedPoolMacroData/)
  assert.match(application, /async loadSavedPool[\s\S]*resolveSavedPoolRecipe[\s\S]*await this\._setPool\(pool\)/)
  assert.doesNotMatch(application.match(/async loadSavedPool[\s\S]*?\n  }/)?.[0] ?? '', /rollDice/)
  assert.match(hooks, /game\.cortexprime\.loadSavedPool/)
})
