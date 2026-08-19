import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  changeResourceValue,
  currentResourceValue,
  initializeActorTypeResources,
  initializeResourceTrait,
  normalizeResourceSettings,
  prepareResourceView,
  pruneImplicitResourceSettings
} from '../module/actor/resourceTraits.js'
import { normalizeActorType } from '../module/actor/normalizeActorType.js'
import { mergeActorTypeConfiguration } from '../module/actor/syncActorType.js'

const resource = (value, valueSettings = {}) => ({
  id: '_resource',
  name: 'Charges',
  resource: value === undefined ? {} : { value },
  valueSettings,
  valueType: 'resource'
})

test('resource normalizes as a typed Trait without mutating source or losing zero', () => {
  const source = { id: '_type', traitSets: { 0: { id: '_set', traits: { 0: resource(0, { min: 0, max: 5 }) } } } }
  const before = structuredClone(source)
  const normalized = normalizeActorType(source)
  const trait = normalized.traitSets[0].traits[0]

  assert.deepEqual(source, before)
  assert.equal(trait.valueType, 'resource')
  assert.equal(trait._resourceView.value, 0)
  assert.equal(trait._resourceView.min, 0)
  assert.equal(trait._resourceView.max, 5)
})

test('resource arithmetic applies step and clamps to minimum and maximum', () => {
  assert.equal(changeResourceValue(resource(3, { min: 0, max: 5, step: 2 }), 1), 5)
  assert.equal(changeResourceValue(resource(4, { min: 0, max: 5, step: 2 }), 1), 5)
  assert.equal(changeResourceValue(resource(3, { min: 0, max: 5, step: 2 }), -1), 1)
  assert.equal(changeResourceValue(resource(1, { min: 0, max: 5, step: 2 }), -1), 0)
})

test('resource without maximum is unlimited', () => {
  const trait = resource(100, { min: 0, step: 5 })
  assert.equal(normalizeResourceSettings(trait.valueSettings).max, null)
  assert.equal(changeResourceValue(trait, 1), 105)
  assert.equal(prepareResourceView(trait).hasMax, false)
})

test('default initializes missing current state while explicit zero wins', () => {
  assert.equal(currentResourceValue(resource(undefined, { default: 5, min: 0, max: 10 })), 5)
  assert.equal(currentResourceValue(resource(0, { default: 5, min: 0, max: 10 })), 0)
  assert.equal(initializeResourceTrait(resource(undefined, { default: 5 })).resource.value, 5)
})

test('new Actor initialization applies Resource defaults without mutating its Actor Type', () => {
  const actorType = { traitSets: { 0: { traits: { 0: resource(undefined, { default: 4 }) } } } }
  const initialized = initializeActorTypeResources(actorType)
  assert.equal(initialized.traitSets[0].traits[0].resource.value, 4)
  assert.deepEqual(actorType.traitSets[0].traits[0].resource, {})
})

test('image presentation modes are exclusive and consume without image falls back', () => {
  const none = prepareResourceView(resource(2, { image: 'charge.webp', imageDisplay: 'none' }))
  const icon = prepareResourceView(resource(2, { image: 'charge.webp', imageDisplay: 'icon' }))
  const consume = prepareResourceView(resource(2, { image: 'charge.webp', imageDisplay: 'consume' }))
  const fallback = prepareResourceView(resource(2, { imageDisplay: 'consume' }))

  assert.equal(none.imageDisplay, 'none')
  assert.equal(icon.imageDisplay, 'icon')
  assert.equal(consume.imageDisplay, 'consume')
  assert.equal(fallback.imageDisplay, 'none')
})

test('opening a form does not persist implicit Resource defaults', () => {
  const submitted = { valueType: 'resource', valueSettings: { min: '', max: '', default: '', step: '', image: '', imageDisplay: 'none' } }
  pruneImplicitResourceSettings(submitted, { valueType: 'resource' })
  assert.deepEqual(submitted, { valueType: 'resource', valueSettings: {} })
})

test('sync initializes new preset Resource and preserves state while updating configuration', () => {
  const original = {
    id: '_type',
    traitSets: { 0: { id: '_set', traits: {} } }
  }
  const firstTemplate = {
    id: '_type',
    traitSets: { 0: { id: '_set', traits: { 0: resource(undefined, { default: 5, min: 0, max: 8, step: 1, image: 'old.webp', imageDisplay: 'icon' }) } } }
  }
  const added = mergeActorTypeConfiguration(original, firstTemplate)
  assert.equal(added.traitSets[0].traits[0].resource.value, 5)

  added.traitSets[0].traits[0].resource.value = 0
  const secondTemplate = structuredClone(firstTemplate)
  secondTemplate.traitSets[0].traits[0].valueSettings = { default: 7, min: 0, max: 12, step: 2, image: 'new.webp', imageDisplay: 'consume' }
  const refreshed = mergeActorTypeConfiguration(added, secondTemplate)
  const trait = refreshed.traitSets[0].traits[0]

  assert.equal(trait.resource.value, 0)
  assert.deepEqual(trait.valueSettings, secondTemplate.traitSets[0].traits[0].valueSettings)
  assert.deepEqual(mergeActorTypeConfiguration(refreshed, secondTemplate), refreshed)
})

test('preset and custom Resource Traits both normalize through the same path', () => {
  const normalized = normalizeActorType({
    id: '_type',
    traitSets: { 0: { id: '_set', traits: { 0: resource(2) }, customTraits: { 0: { ...resource(3), id: '_custom' } } } }
  })
  assert.equal(normalized.traitSets[0].traits[0]._resourceView.value, 2)
  assert.equal(normalized.traitSets[0].customTraits[0]._resourceView.value, 3)
})

test('Resource template keeps image away from increment and supplies ordinary fallback decrement', () => {
  const template = fs.readFileSync(new URL('../templates/partials/value-types/resource.html', import.meta.url), 'utf8')
  const incrementButton = template.match(/<button[^>]*data-direction="1"[\s\S]*?<\/button>/)?.[0]

  assert.match(template, /eq view\.imageDisplay 'icon'/)
  assert.match(template, /eq view\.imageDisplay 'consume'/)
  assert.match(template, /data-direction="-1"/)
  assert.doesNotMatch(incrementButton ?? '', /<img/)
})
