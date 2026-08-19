import test from 'node:test'
import assert from 'node:assert/strict'
import {
  filterRenderableSections,
  isPredefinedSectionAvailable,
  isSectionPlacementEnabled,
  updateBreadcrumbName,
  withSectionPlacementEnabled
} from '../module/actor/actorTypeSections.js'

const sections = [
  { id: 'profile', type: 'profile' },
  { id: 'plotPoints', type: 'plotPoints' },
  { id: 'assets', type: 'assets' },
  { id: 'complications', type: 'complications' },
  { id: '_set', type: 'traitSet' }
]

test('predefined section availability follows Actor Type feature flags', () => {
  const actorType = { hasAssets: false, hasComplications: false, hasPlotPoints: false }

  assert.equal(isPredefinedSectionAvailable(actorType, 'profile'), true)
  assert.equal(isPredefinedSectionAvailable(actorType, 'plotPoints'), false)
  assert.equal(isPredefinedSectionAvailable(actorType, 'assets'), false)
  assert.equal(isPredefinedSectionAvailable(actorType, 'complications'), false)
  assert.deepEqual(filterRenderableSections(actorType, sections).map(section => section.id), ['profile', '_set'])
})

test('missing legacy enabled values preserve prior visible behavior', () => {
  assert.equal(isSectionPlacementEnabled(undefined), true)
  assert.equal(isSectionPlacementEnabled({ tabId: '_tab', width: 'half' }), true)
})

test('disabling and restoring a Trait Set section preserves its data', () => {
  const actorType = {
    sectionLayout: { _set: { order: 2, tabId: '_tab', width: 'half' } },
    traitSets: { 0: { id: '_set', label: 'Stress', traits: { 0: { id: '_trait', name: 'Physical' } } } }
  }
  const originalTraits = structuredClone(actorType.traitSets)
  const hidden = withSectionPlacementEnabled(actorType, '_set', false)

  assert.deepEqual(hidden.traitSets, originalTraits)
  assert.deepEqual(filterRenderableSections(hidden, sections).map(section => section.id), ['profile'])

  const restored = withSectionPlacementEnabled(hidden, '_set', true)
  assert.deepEqual(restored.traitSets, originalTraits)
  assert.deepEqual(filterRenderableSections(restored, sections).map(section => section.id), ['profile', '_set'])
})

test('hidden predefined sections retain unrelated actor data', () => {
  const actorType = {
    assets: { 0: { label: 'Jet' } },
    hasAssets: true,
    sectionLayout: { assets: { enabled: true, order: 2 } }
  }
  const hidden = withSectionPlacementEnabled(actorType, 'assets', false)

  assert.deepEqual(hidden.assets, actorType.assets)
  assert.equal(filterRenderableSections(hidden, sections).some(section => section.id === 'assets'), false)
})

test('committed renames update referenced breadcrumb labels immutably', () => {
  const breadcrumbs = {
    0: { name: 'Actors', target: 'actorTypes' },
    1: { name: 'Old Name', target: 'traitSet-0-0' }
  }
  const renamed = updateBreadcrumbName(breadcrumbs, 'traitSet-0-0', 'Stress')

  assert.equal(renamed[1].name, 'Stress')
  assert.equal(breadcrumbs[1].name, 'Old Name')
})
