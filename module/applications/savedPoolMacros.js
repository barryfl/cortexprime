export const dicePoolFolderName = user => `Cortex Prime Dice Pools - ${user.name}`

const cortexFlags = document => document?.flags?.cortexprime ?? {}
const collectionValues = collection => collection?.contents ?? (
  typeof collection?.values === 'function' ? Array.from(collection.values()) : Array.from(collection ?? [])
)

export const findUserDicePoolFolder = (folders, userId) => collectionValues(folders).find(folder => {
  const flags = cortexFlags(folder)
  return folder.type === 'Macro' && flags.dicePoolMacroFolder === true && flags.userId === userId
})

export const createDicePoolFolderData = user => ({
  name: dicePoolFolderName(user),
  type: 'Macro',
  flags: {
    cortexprime: {
      dicePoolMacroFolder: true,
      userId: user.id
    }
  }
})

export async function ensureUserDicePoolFolder (user, {
  createFolder,
  folders,
  updateFolder
}) {
  const expectedName = dicePoolFolderName(user)
  const existing = findUserDicePoolFolder(folders, user.id)
  if (existing) {
    if (existing.name !== expectedName) await updateFolder(existing, { name: expectedName })
    return existing
  }
  return createFolder(createDicePoolFolderData(user))
}
