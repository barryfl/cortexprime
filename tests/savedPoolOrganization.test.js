import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createSavedPoolMacroData } from '../module/applications/dicePoolRecipes.js'
import {
  createDicePoolFolderData,
  ensureUserDicePoolFolder,
  findUserDicePoolFolder
} from '../module/applications/savedPoolMacros.js'
import { planOrphanDeletion, scanSavedPools } from '../module/settings/savedPoolCleanup.js'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const user = (id, name, savedPools = {}) => ({ id, name, flags: { cortexprime: { savedPools } } })
const macro = (ownerUserId, savedPoolId, overrides = {}) => ({
  name: overrides.name ?? 'Any Macro Name',
  folder: overrides.folder ?? null,
  flags: { cortexprime: { savedPoolMacro: true, ownerUserId, savedPoolId } }
})

test('Dice Pool labels distinguish source removal from global clearing', () => {
  const template = read('templates/dice-pool.html')
  assert.match(template, /data-action="clearSource"[\s\S]*localize 'RemoveSource'/)
  assert.match(template, /data-action="clearPool"[\s\S]*localize 'ClearPool'/)
  assert.equal((template.match(/data-action="clearPool"/g) ?? []).length, 1)
})

test('all Dice Pool footer controls are independent wrapping children', () => {
  const template = read('templates/dice-pool.html')
  assert.match(template, /flex-col col-12 flex flex-wrap flex-je/)
  for (const action of ['rollPool', 'clearPool', 'exportMacro']) {
    assert.match(template, new RegExp(`<div class="flex-col pl-0">\\s*<button[^>]+data-action="${action}"`))
  }
})

test('per-user Macro folder data uses a stable user-ID flag and friendly name', () => {
  const fred = user('user-fred', 'Fred')
  assert.deepEqual(createDicePoolFolderData(fred), {
    name: 'Cortex Prime Dice Pools - Fred',
    type: 'Macro',
    flags: { cortexprime: { dicePoolMacroFolder: true, userId: 'user-fred' } }
  })
})

test('folder lookup reuses user identity despite names and collisions', async () => {
  const target = {
    id: 'folder1',
    name: 'Cortex Prime Dice Pools - Old Fred',
    type: 'Macro',
    flags: { cortexprime: { dicePoolMacroFolder: true, userId: 'user-fred' } }
  }
  const collision = {
    id: 'folder2',
    name: 'Cortex Prime Dice Pools - Fred',
    type: 'Macro',
    flags: { cortexprime: { dicePoolMacroFolder: true, userId: 'another-user' } }
  }
  assert.equal(findUserDicePoolFolder([collision, target], 'user-fred'), target)

  let created = 0
  let renamed
  const result = await ensureUserDicePoolFolder(user('user-fred', 'Fred'), {
    folders: [collision, target],
    createFolder: async () => { created++ },
    updateFolder: async (folder, change) => { renamed = { folder, change } }
  })
  assert.equal(result, target)
  assert.equal(created, 0)
  assert.deepEqual(renamed.change, { name: 'Cortex Prime Dice Pools - Fred' })
})

test('folder is created once when no flagged identity exists', async () => {
  const fred = user('user-fred', 'Fred')
  const createdFolder = { id: 'new-folder', ...createDicePoolFolderData(fred) }
  let createCount = 0
  const result = await ensureUserDicePoolFolder(fred, {
    folders: [],
    createFolder: async data => { createCount++; assert.deepEqual(data, createDicePoolFolderData(fred)); return createdFolder },
    updateFolder: async () => assert.fail('should not update')
  })
  assert.equal(createCount, 1)
  assert.equal(result.id, 'new-folder')
})

test('Macro metadata identifies owner and saved recipe independently of folder', () => {
  const data = createSavedPoolMacroData('Craft', 'pool1', 'user-fred', { folderId: 'folder1', ownerLevel: 3 })
  assert.equal(data.folder, 'folder1')
  assert.deepEqual(data.ownership, { 'user-fred': 3 })
  assert.deepEqual(data.flags.cortexprime, {
    ownerUserId: 'user-fred',
    savedPoolId: 'pool1',
    savedPoolMacro: true
  })
  assert.equal(data.command, 'return game.cortexprime.loadSavedPool("pool1");')
})

test('global cleanup groups all users and detects referenced and orphaned recipes by flags', () => {
  const fred = user('fred', 'Fred', { used: { name: 'Crafting' }, old: { name: 'Old Pool' } })
  const erin = user('erin', 'Erin', { social: { name: 'Social' }, test: { name: 'Test Export' } })
  const movedAndRenamedMacro = macro('fred', 'used', { name: 'Renamed Macro', folder: 'unrelated-folder' })
  const socialMacro = macro('erin', 'social')
  const groups = scanSavedPools([fred, erin], [movedAndRenamedMacro, socialMacro])

  assert.deepEqual(groups[0].referenced.map(item => item.id), ['used'])
  assert.deepEqual(groups[0].orphaned.map(item => item.id), ['old'])
  assert.deepEqual(groups[1].referenced.map(item => item.id), ['social'])
  assert.deepEqual(groups[1].orphaned.map(item => item.id), ['test'])
})

test('cleanup deletion removes only selected confirmed orphans', () => {
  const fred = user('fred', 'Fred', { used: { name: 'Used' }, old: { name: 'Old' }, other: { name: 'Other' } })
  const plan = planOrphanDeletion([fred], [macro('fred', 'used')], ['fred:used', 'fred:old'])
  assert.equal(plan.deleted, 1)
  assert.deepEqual(plan.updates[0].savedPools, { used: { name: 'Used' }, other: { name: 'Other' } })
  assert.deepEqual(fred.flags.cortexprime.savedPools, { used: { name: 'Used' }, old: { name: 'Old' }, other: { name: 'Other' } })
})

test('ambiguous saved-pool Macro metadata protects recipes from deletion', () => {
  const fred = user('fred', 'Fred', { one: { name: 'One' } })
  const ambiguous = macro('fred', undefined)
  const groups = scanSavedPools([fred], [ambiguous])
  assert.equal(groups[0].orphaned.length, 0)
  assert.equal(groups[0].referenced[0].id, 'one')

  const legacyMacro = { command: 'return game.cortexprime.loadSavedPool("one");', flags: {} }
  const legacyGroups = scanSavedPools([fred], [legacyMacro])
  assert.equal(legacyGroups[0].orphaned.length, 0)
})

test('cleanup menu and application enforce GM-only access', () => {
  const settings = read('module/settings/settings.js')
  const application = read('module/settings/SavedPoolCleanupSettings.js')
  assert.match(settings, /registerMenu\('cortexprime', 'SavedPoolCleanup'[\s\S]*restricted: true/)
  assert.match(application, /if \(!game\.user\.isGM\) return false/)
})
