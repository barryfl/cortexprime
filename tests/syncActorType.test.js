import test from 'node:test'
import assert from 'node:assert/strict'
import {
  actorsMatchingActorType,
  mergeActorTypeConfiguration,
  syncActorWithActorType,
  syncActorsWithActorType
} from '../module/actor/syncActorType.js'

const byId = collection => Object.fromEntries(Object.values(collection ?? {}).map(value => [value.id, value]))

const actorTypeData = () => ({
  assets: { 0: { label: 'Jet', dice: { value: { 0: '8' } } } },
  complications: { 0: { label: 'Injured', dice: { value: { 0: '10' } } } },
  hasAssets: false,
  id: '_type',
  name: 'Old Type Name',
  notes: { 0: { label: 'Private', value: 'Keep me' } },
  sectionLayout: {
    _set: { enabled: true, order: 4, tabId: '_old-tab', width: 'full' },
    _retiredSet: { enabled: true, order: 5, tabId: '_retired-tab', width: 'half' }
  },
  sectionTabs: { assets: '_old-tab', profile: '_old-tab' },
  simpleTraits: {
    0: { id: '_legacy-number', label: 'Old Legacy Number', settings: { valueType: 'number' }, number: { value: 0, max: 8 }, hidden: true },
    1: { id: '_legacy-die', label: 'Old Legacy Die', settings: { consumableDice: true, valueType: 'dice' }, dice: { consumable: true, value: { 0: '6' } } },
    2: { id: '_legacy-text-retired', label: 'Retired Legacy', settings: { valueType: 'text' }, text: { value: '' } }
  },
  tabs: {
    0: { id: '_old-tab', label: 'Old First' },
    1: { id: '_main-tab', label: 'Old Main' },
    2: { id: '_retired-tab', label: 'Retired Tab' }
  },
  traitSets: {
    0: {
      customTraits: { 0: { id: '_custom', name: 'My Custom Trait', dice: { value: { 0: '12' } } } },
      id: '_set',
      label: 'Old Set',
      shutdown: true,
      settings: { hasDice: true },
      traits: {
        0: { dice: { consumable: true, value: { 0: '6' } }, id: '_die', name: 'Old Die', shutdown: true, valueType: 'die' },
        1: { id: '_number', label: 'Old Config Label', name: 'Old Number', number: { max: 8, value: 0 }, valueType: 'number' },
        2: { id: '_text', name: 'Old Text', text: { value: '' }, valueType: 'text' },
        3: {
          descriptors: { 0: { label: 'Old Descriptor', value: 'Actor value' } },
          id: '_complex',
          name: 'Old Complex',
          sfx: { 0: { description: 'Old SFX', label: 'Old SFX', unlocked: false } },
          subTraits: { 0: { dice: { value: { 0: '6' } }, label: 'Old Subtrait' } },
          valueType: 'die'
        },
        4: { dice: { value: { 0: '4' } }, id: '_retiredTrait', name: 'Retired Trait', valueType: 'die' }
      }
    },
    1: {
      id: '_retiredSet',
      label: 'Retired Set',
      traits: { 0: { id: '_retiredSetTrait', name: 'Still Here', text: { value: 'actor data' }, valueType: 'text' } }
    }
  }
})

const actorTypeTemplate = () => ({
  hasAssets: true,
  hasComplications: true,
  hasNotesPage: false,
  hasPlotPoints: true,
  id: '_type',
  name: 'Renamed Type',
  sectionLayout: {
    _set: { enabled: false, order: 1, tabId: '_main-tab', width: 'third' },
    _newSet: { enabled: true, order: 2, tabId: '_new-tab', width: 'half' }
  },
  sectionTabs: { assets: '_main-tab', profile: '_main-tab' },
  simpleTraits: {
    0: { id: '_legacy-number', label: 'Legacy Number', settings: { hasMaxNumber: true, valueType: 'number' }, number: { value: 4, max: 12 } },
    1: { id: '_legacy-die', label: 'Legacy Die', settings: { diceConsumable: true, valueType: 'dice' }, dice: { value: { 0: '10' } } },
    2: { id: '_legacy-die-new', label: 'New Legacy Die', settings: { valueType: 'dice' }, dice: { value: { 0: '8' } } }
  },
  tabs: {
    0: { id: '_main-tab', label: 'Main Renamed' },
    1: { id: '_old-tab', label: 'Second Renamed' },
    2: { id: '_new-tab', label: 'New Tab' }
  },
  traitSets: {
    0: {
      description: 'New set description',
      id: '_set',
      label: 'Renamed Set',
      settings: { hasDescription: true, hasDice: true, hasSfx: true },
      tabId: '_main-tab',
      traits: {
        0: { dice: { value: { 0: '10' } }, id: '_die', name: 'Renamed Die', valueSettings: { consumableDice: true }, valueType: 'die' },
        1: { id: '_number', label: 'New Config Label', name: 'Renamed Number', number: { max: 12, value: 5 }, valueSettings: { hasMaxNumber: true }, valueType: 'number' },
        2: { id: '_text', name: 'Renamed Text', text: { value: 'default' }, valueType: 'text' },
        3: {
          description: 'New complex description',
          descriptors: { 0: { label: 'New Descriptor', value: 'Template value' }, 1: { label: 'New Descriptor 2', value: 'New' } },
          id: '_complex',
          name: 'Renamed Complex',
          sfx: { 0: { description: 'New SFX', label: 'Renamed SFX', unlocked: true }, 1: { description: 'Added SFX', label: 'New SFX', unlocked: true } },
          subTraits: { 0: { dice: { value: { 0: '10' } }, label: 'Renamed Subtrait' } },
          valueType: 'die'
        },
        4: { id: '_addedTrait', name: 'Added Trait', number: { max: 10, value: 2 }, valueType: 'number' }
      }
    },
    1: {
      id: '_newSet',
      label: 'New Set',
      settings: { hasDice: false },
      tabId: '_new-tab',
      traits: { 0: { id: '_newSetTrait', name: 'New Set Trait', text: { value: 'new' }, valueType: 'text' } }
    }
  }
})

test('non-destructive refresh applies configuration and preserves current actor state', () => {
  const actorData = actorTypeData()
  const template = actorTypeTemplate()
  const merged = mergeActorTypeConfiguration(actorData, template)
  const tabs = byId(merged.tabs)
  const sets = byId(merged.traitSets)
  const traits = byId(sets._set.traits)
  const legacy = byId(merged.simpleTraits)

  assert.deepEqual(Object.values(merged.tabs).map(tab => tab.id), ['_main-tab', '_old-tab', '_new-tab', '_retired-tab'])
  assert.equal(tabs['_main-tab'].label, 'Main Renamed')
  assert.equal(merged.sectionLayout._set.enabled, false)
  assert.equal(merged.sectionLayout._set.tabId, '_main-tab')
  assert.equal(merged.sectionLayout._set.order, 1)
  assert.equal(merged.sectionLayout._set.width, 'third')
  assert.deepEqual(merged.sectionLayout._retiredSet, actorData.sectionLayout._retiredSet)
  assert.equal(merged.sectionTabs.assets, '_main-tab')

  assert.deepEqual(Object.values(merged.traitSets).map(set => set.id), ['_set', '_newSet', '_retiredSet'])
  assert.equal(sets._set.label, 'Renamed Set')
  assert.equal(sets._set.description, 'New set description')
  assert.equal(sets._set.shutdown, true)
  assert.equal(sets._newSet.label, 'New Set')
  assert.equal(sets._retiredSet.label, 'Retired Set')

  assert.equal(traits._die.name, 'Renamed Die')
  assert.deepEqual(traits._die.dice.value, { 0: '6' })
  assert.equal(traits._die.dice.consumable, true)
  assert.equal(traits._number.name, 'Renamed Number')
  assert.equal(traits._number.label, 'New Config Label')
  assert.equal(traits._number.number.value, 0)
  assert.equal(traits._number.number.max, 12)
  assert.equal(traits._text.name, 'Renamed Text')
  assert.equal(traits._text.text.value, '')
  assert.equal(traits._complex.description, 'New complex description')
  assert.equal(traits._complex.descriptors[0].label, 'New Descriptor')
  assert.equal(traits._complex.sfx[0].label, 'Renamed SFX')
  assert.equal(traits._complex.sfx[0].unlocked, false)
  assert.deepEqual(traits._complex.subTraits[0].dice.value, { 0: '6' })
  assert.equal(traits._addedTrait.name, 'Added Trait')
  assert.equal(traits._retiredTrait.name, 'Retired Trait')
  assert.deepEqual(sets._set.customTraits, actorData.traitSets[0].customTraits)

  assert.equal(legacy['_legacy-number'].label, 'Legacy Number')
  assert.equal(legacy['_legacy-number'].number.value, 0)
  assert.equal(legacy['_legacy-number'].number.max, 12)
  assert.equal(legacy['_legacy-number'].hidden, true)
  assert.deepEqual(legacy['_legacy-die'].dice.value, { 0: '6' })
  assert.equal(legacy['_legacy-die'].dice.consumable, true)
  assert.equal(legacy['_legacy-die'].settings.diceConsumable, true)
  assert.equal(legacy['_legacy-text-retired'].text.value, '')
  assert.equal(legacy['_legacy-die-new'].label, 'New Legacy Die')

  assert.deepEqual(merged.assets, actorData.assets)
  assert.deepEqual(merged.complications, actorData.complications)
  assert.deepEqual(merged.notes, actorData.notes)
  assert.equal(merged.name, 'Renamed Type')
  assert.equal(merged.hasPlotPoints, true)
})

test('refresh is idempotent and does not duplicate retained objects', () => {
  const template = actorTypeTemplate()
  const once = mergeActorTypeConfiguration(actorTypeData(), template)
  const twice = mergeActorTypeConfiguration(once, template)

  assert.deepEqual(twice, once)
})

test('actor matching uses only the stable Actor Type ID', () => {
  const actors = [
    { id: 'a', system: { actorType: { id: '_type', name: 'Different Name' } } },
    { id: 'b', system: { actorType: { id: '_other', name: 'Renamed Type' } } },
    { id: 'c', system: { actorType: { id: '_type' } } },
    { id: 'd', system: {} }
  ]

  assert.deepEqual(actorsMatchingActorType(actors, '_type').map(actor => actor.id), ['a', 'c'])
  assert.deepEqual(actorsMatchingActorType({ contents: actors }, '_type').map(actor => actor.id), ['a', 'c'])
})

test('individual and bulk document sync use the same merge and preserve unrelated Actor data', async () => {
  const makeActor = (id, typeId = '_type') => ({
    id,
    img: `${id}.webp`,
    name: `Actor ${id}`,
    system: { actorType: { ...actorTypeData(), id: typeId }, pp: { value: 7 } },
    async update (change) { this.system.actorType = change['system.actorType'] }
  })
  const first = makeActor('a')
  const second = makeActor('b')
  const other = makeActor('c', '_other')
  const template = actorTypeTemplate()

  await syncActorWithActorType(first, template)
  assert.equal(first.system.actorType.name, 'Renamed Type')
  assert.equal(first.system.pp.value, 7)
  assert.equal(first.name, 'Actor a')
  assert.equal(first.img, 'a.webp')

  const updated = await syncActorsWithActorType(template, [first, second, other])
  assert.deepEqual(updated.map(actor => actor.id), ['a', 'b'])
  assert.equal(second.system.actorType.name, 'Renamed Type')
  assert.equal(other.system.actorType.id, '_other')
})
