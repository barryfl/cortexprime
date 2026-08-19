export const createBlankDicePool = () => ({
  customAdd: {
    label: '',
    value: { 0: '8' }
  },
  pool: {}
})

/** Replace the transient user flag, including removal of stale nested keys. */
export async function resetUserDicePool (user) {
  const blankPool = createBlankDicePool()
  await user.setFlag('cortexprime', 'dicePool', null)
  await user.setFlag('cortexprime', 'dicePool', blankPool)
  return blankPool
}

/** Close only after the roll flow reports a committed result. */
export async function completeDicePoolRoll (performRoll, closePool) {
  const result = await performRoll()
  if (!result) return result
  await closePool()
  return result
}
