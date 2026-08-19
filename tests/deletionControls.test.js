import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { isActorLocalRemoval, removeIndexedItem, removeSettingItem } from '../module/scripts/deletionHelpers.js'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Actor Type and nested settings deletion reindexes without changing unrelated data', () => {
  const source = {
    0: {
      id: 'hero',
      name: 'Hero',
      sectionLayout: { setA: { enabled: true }, setB: { enabled: true } },
      traitSets: {
        0: { id: 'setA', label: 'First' },
        1: { id: 'setB', label: 'Second' }
      }
    },
    1: { id: 'scene', name: 'Scene' }
  }

  const traitSetResult = removeSettingItem(source, '0.traitSets', '0')
  assert.deepEqual(traitSetResult.settings[0].traitSets, { 0: { id: 'setB', label: 'Second' } })
  assert.equal(traitSetResult.settings[0].sectionLayout.setA, undefined)
  assert.deepEqual(traitSetResult.settings[0].sectionLayout.setB, { enabled: true })
  assert.deepEqual(source[0].traitSets[0], { id: 'setA', label: 'First' })

  const actorTypeResult = removeSettingItem(source, undefined, '0')
  assert.deepEqual(actorTypeResult.settings, { 0: { id: 'scene', name: 'Scene' } })
})

test('indexed local deletion is repeatable and preserves sibling state', () => {
  const collection = {
    0: { label: 'Delete me' },
    1: { label: 'Keep me', value: 0 },
    2: { label: 'Also delete me' }
  }

  const once = removeIndexedItem(collection, 0)
  const twice = removeIndexedItem(once, 1)
  assert.deepEqual(twice, { 0: { label: 'Keep me', value: 0 } })
  assert.equal(collection[1].value, 0)
})

test('Actor Settings exposes all supported template delete controls', () => {
  const actorTypes = read('templates/partials/settings/actor-types.html')
  const actorType = read('templates/partials/settings/actor-type.html')
  const traitSet = read('templates/partials/settings/trait-set.html')
  const trait = read('templates/partials/settings/trait.html')
  const descriptors = read('templates/partials/value-types/descriptors.html')
  const sfx = read('templates/partials/value-types/sfx.html')
  const subTraits = read('templates/partials/value-types/sub-traits.html')

  assert.match(actorTypes, /setting="actorTypes"[\s\S]*stayOnPage=true/)
  assert.match(actorType, /group=\(concat \.\.\/actorTypeIndex '\.traitSets'\)/)
  assert.match(actorType, /class="btn btn-icon btn-icon-plain-cpt remove-actor-tab"/)
  assert.match(traitSet, /group=\(concat \.\.\/path '\.' \.\.\/traitSetIndex '\.traits'\)/)
  assert.match(trait, /group=collectionPath/)
  for (const partial of [descriptors, sfx, subTraits]) {
    assert.match(partial, /remove-button\.html/)
    assert.match(partial, /stayOnPage=true/)
  }
})

test('settings deletion keeps same-view and navigation behavior distinct', () => {
  const list = read('templates/partials/settings/actor-types.html')
  const detail = read('templates/partials/settings/trait.html')
  const helper = read('module/scripts/settingsHelpers.js')

  assert.match(list, /stayOnPage=true/)
  assert.doesNotMatch(detail, /stayOnPage=true/)
  assert.match(helper, /if \(setting === 'actorTypes' && !stayOnPage\) await this\.render/)
  assert.match(helper, /else await \(this\._renderPreservingScroll/)
})

test('Actor Sheet exposes deletion only for actor-local collections', () => {
  const traits = read('templates/partials/actor-sheet/traits-edit.html')
  const temporaryTraits = read('templates/partials/actor-sheet/temporary-traits.html')
  const notes = read('templates/actor/actor-sheet.html')
  const sheetHelper = read('module/scripts/sheetHelpers.js')

  assert.match(traits, /#if \(and \.\.\/custom \.\.\/editable\)[\s\S]*remove-button\.html/)
  assert.match(traits, /canDelete=\.\.\/editable/g)
  assert.match(temporaryTraits, /target='assets'/)
  assert.match(temporaryTraits, /target='complications'/)
  assert.match(notes, /target='notes'/)
  assert.match(sheetHelper, /DialogV2\.confirm/)
  assert.match(sheetHelper, /await removeDataPoint\.call/)
  assert.equal(isActorLocalRemoval('system.actorType.traitSets.0', 'customTraits'), true)
  assert.equal(isActorLocalRemoval('system.actorType', 'assets'), true)
  assert.equal(isActorLocalRemoval('system.actorType', 'complications'), true)
  assert.equal(isActorLocalRemoval('system.actorType', 'notes'), true)
  assert.equal(isActorLocalRemoval('system.actorType.traitSets.0', 'traits'), false)
  assert.equal(isActorLocalRemoval('system.actorType', 'traitSets'), false)
})

test('final-tab guard and tab reassignment remain in the dedicated handler', () => {
  const settings = read('module/settings/ActorSettings.js')
  assert.match(settings, /if \(getLength\(tabs\) <= 1\)/)
  assert.match(settings, /CannotRemoveLastTab/)
  assert.match(settings, /layout => \(\{[\s\S]*tabId: remainingTabIds\.includes/)
})

test('delete handlers capture their target before an awaited save', () => {
  const settingsHelper = read('module/scripts/settingsHelpers.js')
  const datasetPosition = settingsHelper.indexOf('event.currentTarget.dataset')
  const savePosition = settingsHelper.indexOf('await this._saveCurrentForm()', settingsHelper.indexOf('export const removeItem'))
  assert.ok(datasetPosition >= 0)
  assert.ok(datasetPosition < savePosition)
})
