import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { normalizeActorType } from '../module/actor/normalizeActorType.js'
import { prepareResourceView } from '../module/actor/resourceTraits.js'
import { mergeActorTypeConfiguration } from '../module/actor/syncActorType.js'
import { getTraitPresentation, pruneImplicitTraitPresentation } from '../module/actor/traitPresentation.js'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const die = presentation => ({
  id: '_craft',
  name: 'Craft',
  valueType: 'die',
  dice: { value: { 0: '8' } },
  ...(presentation ? { presentation } : {})
})

test('die presentation defaults to none without producing an image action', () => {
  assert.deepEqual(getTraitPresentation(die()), {
    hasImage: false,
    image: '',
    imageDisplay: 'none',
    showIcon: false,
    useConsumeImage: false,
    useImageAction: false
  })
  assert.equal(getTraitPresentation(die({ imageDisplay: 'addToPool' })).imageDisplay, 'none')
})

test('die icon and addToPool modes are mutually exclusive', () => {
  const icon = getTraitPresentation(die({ image: 'icons/craft.webp', imageDisplay: 'icon' }))
  const action = getTraitPresentation(die({ image: 'icons/craft.webp', imageDisplay: 'addToPool' }))
  assert.equal(icon.showIcon, true)
  assert.equal(icon.useImageAction, false)
  assert.equal(action.showIcon, false)
  assert.equal(action.useImageAction, true)
})

test('Resource none, icon, consume, and missing-image fallback remain unchanged', () => {
  const resource = (image, imageDisplay) => ({
    valueType: 'resource',
    resource: { value: 2 },
    valueSettings: { image, imageDisplay, min: 0, max: 5, step: 1 }
  })
  assert.equal(prepareResourceView(resource('charge.webp', 'none')).imageDisplay, 'none')
  assert.equal(prepareResourceView(resource('charge.webp', 'icon')).imageDisplay, 'icon')
  assert.equal(prepareResourceView(resource('charge.webp', 'consume')).imageDisplay, 'consume')
  assert.equal(prepareResourceView(resource('', 'consume')).imageDisplay, 'none')
})

test('normalization exposes presentation at read time without mutating legacy/no-image data', () => {
  const input = {
    traitSets: {
      0: {
        id: '_set',
        settings: { hasDice: true },
        traits: {
          0: die(),
          1: { ...die({ image: 'craft.webp', imageDisplay: 'icon' }), id: '_image' }
        }
      }
    }
  }
  const before = structuredClone(input)
  const normalized = normalizeActorType(input)
  assert.deepEqual(input, before)
  assert.equal(normalized.traitSets[0].traits[0]._presentationView.imageDisplay, 'none')
  assert.equal(normalized.traitSets[0].traits[1]._presentationView.showIcon, true)
})

test('empty presentation form defaults are pruned instead of persisted', () => {
  const submitted = { valueType: 'die', presentation: { image: '', imageDisplay: 'none' } }
  pruneImplicitTraitPresentation(submitted, { valueType: 'die' })
  assert.equal(Object.hasOwn(submitted, 'presentation'), false)
})

test('Actor Type sync propagates die presentation while preserving current die and temporary state', () => {
  const actorType = {
    id: '_type',
    traitSets: { 0: { id: '_set', traits: { 0: { ...die(), temporaryStep: 1 } } } }
  }
  const template = {
    id: '_type',
    traitSets: { 0: { id: '_set', traits: { 0: { ...die({ image: 'new.webp', imageDisplay: 'addToPool' }), dice: { value: { 0: '12' } } } } } }
  }
  const merged = mergeActorTypeConfiguration(actorType, template)
  assert.deepEqual(merged.traitSets[0].traits[0].presentation, { image: 'new.webp', imageDisplay: 'addToPool' })
  assert.deepEqual(merged.traitSets[0].traits[0].dice.value, { 0: '8' })
  assert.equal(merged.traitSets[0].traits[0].temporaryStep, 1)
})

test('raw import/export data preserves die presentation without migration', () => {
  const imported = { id: '_type', traitSets: { 0: { traits: { 0: die({ image: 'craft.webp', imageDisplay: 'icon' }) } } } }
  const serialized = JSON.stringify(imported)
  normalizeActorType(imported)
  assert.equal(JSON.stringify(imported), serialized)
  assert.deepEqual(JSON.parse(serialized).traitSets[0].traits[0].presentation, { image: 'craft.webp', imageDisplay: 'icon' })
})

test('Actor Sheet uses the existing pool action and retains temporary/effective Trait controls', () => {
  const traits = read('templates/partials/actor-sheet/traits.html')
  const settings = read('templates/partials/settings/trait-presentation.html')
  const edit = read('templates/partials/actor-sheet/traits-edit.html')

  assert.match(traits, /_presentationView\.showIcon[\s\S]*<img class="trait-image-cpt"/)
  assert.match(traits, /_presentationView\.useImageAction[\s\S]*data-action="addToPool"/)
  assert.match(traits, /trait-image-fallback-cpt hide[\s\S]*data-action="addToPool"/)
  assert.match(traits, /not trait\._presentationView\.useImageAction[\s\S]*add-to-pool/)
  assert.equal((traits.match(/data-action="addToPool"/g) ?? []).length >= 2, true)
  assert.doesNotMatch(traits, /<img[^>]+src="\{\{trait\._presentationView\.image\}\}"[^>]*>\s*\{\{else/)
  assert.match(traits, /temporary-die\.html/)
  assert.match(settings, /data-action="traitImagePicker"/)
  assert.match(settings, /value="addToPool"/)
  assert.match(edit, /trait-presentation\.html/)

  const sheet = read('module/actor/actor-sheet.js')
  assert.match(sheet, /addEventListener\('error', handleError/)
  assert.match(sheet, /action\.nextElementSibling\?\.classList\.remove\('hide'\)/)
})

test('new presentation partial is preloaded', () => {
  assert.match(read('module/handlebars/preloadTemplates.js'), /'settings\/trait-presentation'/)
})
