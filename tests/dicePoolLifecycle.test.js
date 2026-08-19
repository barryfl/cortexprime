import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  completeDicePoolRoll,
  createBlankDicePool,
  resetUserDicePool
} from '../module/applications/dicePoolLifecycle.js'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('blank Dice Pools are fresh objects with the required custom-add shape', () => {
  const first = createBlankDicePool()
  const second = createBlankDicePool()
  first.customAdd.label = 'Changed'
  first.customAdd.value[0] = '12'
  first.pool.actor = { 0: { label: 'Trait', value: { 0: '8' } } }

  assert.deepEqual(second, { customAdd: { label: '', value: { 0: '8' } }, pool: {} })
  assert.notEqual(first, second)
  assert.notEqual(first.customAdd, second.customAdd)
  assert.notEqual(first.customAdd.value, second.customAdd.value)
})

test('flag reset is idempotent and removes stale nested pool state', async () => {
  const writes = []
  const user = {
    async setFlag (scope, key, value) {
      writes.push({ key, scope, value: structuredClone(value) })
      this.value = value
    }
  }

  const first = await resetUserDicePool(user)
  first.pool.changed = true
  const second = await resetUserDicePool(user)

  assert.equal(writes.length, 4)
  assert.equal(writes[0].value, null)
  assert.deepEqual(writes[1].value, { customAdd: { label: '', value: { 0: '8' } }, pool: {} })
  assert.equal(writes[2].value, null)
  assert.deepEqual(second, { customAdd: { label: '', value: { 0: '8' } }, pool: {} })
  assert.notEqual(first, second)
})

test('successful roll completes before close clears the pool', async () => {
  const order = []
  const result = await completeDicePoolRoll(async () => {
    order.push('roll-read-pool')
    order.push('chat-created')
    return { id: 'message' }
  }, async () => {
    order.push('close-and-reset')
  })

  assert.deepEqual(order, ['roll-read-pool', 'chat-created', 'close-and-reset'])
  assert.deepEqual(result, { id: 'message' })
})

test('cancelled or failed roll does not close or clear the pool', async () => {
  let closeCount = 0
  const cancelled = await completeDicePoolRoll(async () => null, async () => { closeCount++ })
  assert.equal(cancelled, null)
  assert.equal(closeCount, 0)

  await assert.rejects(
    completeDicePoolRoll(async () => { throw new Error('cancelled') }, async () => { closeCount++ }),
    /cancelled/
  )
  assert.equal(closeCount, 0)
})

test('application lifecycle resets on startup and close, not before rolling', () => {
  const application = read('module/applications/UserDicePool.js')
  const rollDice = read('module/scripts/rollDice.js')

  assert.match(application, /async initPool \(\)[\s\S]*_resetDicePool\(\{ rerender: false \}\)/)
  assert.match(application, /async close \(options = \{\}\)[\s\S]*_resetDicePool\(\{ rerender: false \}\)[\s\S]*super\.close/)
  assert.match(application, /const dicePool = this\._getDicePool\(\)\.pool[\s\S]*completeDicePoolRoll/)
  assert.doesNotMatch(rollDice, /_clearDicePool/)
  assert.match(rollDice, /return ChatMessage\.create/)
})

test('explicit clearing and deliberate closed-window population retain their existing flows', () => {
  const application = read('module/applications/UserDicePool.js')
  const actorSheet = read('module/actor/actor-sheet.js')
  const hooks = read('module/cortexPrimeHooks.js')

  assert.match(application, /async _clearDicePool[\s\S]*return this\._resetDicePool\(\)/)
  assert.match(application, /async _addTraitToPool[\s\S]*_renderPreservingScroll\(\)/)
  assert.match(application, /async _setPool[\s\S]*_renderPreservingScroll\(\)/)
  assert.match(actorSheet, /UserDicePool\._addTraitToPool/)
  assert.match(hooks, /UserDicePool\._setPool\(pool\)/)
})
