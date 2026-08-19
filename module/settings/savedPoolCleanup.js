const cortexFlags = document => document?.flags?.cortexprime ?? {}

export const macroSavedPoolReference = macro => {
  const flags = cortexFlags(macro)
  if (flags.savedPoolMacro !== true) return null
  return {
    ownerUserId: flags.ownerUserId,
    savedPoolId: flags.savedPoolId
  }
}

export function scanSavedPools (users, macros) {
  const references = []
  let globallyAmbiguous = false
  const ambiguousUsers = new Set()

  for (const macro of Array.from(macros ?? [])) {
    const reference = macroSavedPoolReference(macro)
    if (!reference) {
      if (macro?.command?.includes('game.cortexprime.loadSavedPool')) globallyAmbiguous = true
      continue
    }
    if (!reference.ownerUserId) {
      globallyAmbiguous = true
      continue
    }
    if (!reference.savedPoolId) {
      ambiguousUsers.add(reference.ownerUserId)
      continue
    }
    references.push(reference)
  }

  return Array.from(users ?? []).map(user => {
    const savedPools = user.flags?.cortexprime?.savedPools ?? {}
    const protectAll = globallyAmbiguous || ambiguousUsers.has(user.id)
    const referencedIds = new Set(references
      .filter(reference => reference.ownerUserId === user.id)
      .map(reference => reference.savedPoolId))
    const referenced = []
    const orphaned = []

    for (const [savedPoolId, recipe] of Object.entries(savedPools)) {
      const item = {
        id: savedPoolId,
        name: recipe?.name || savedPoolId,
        selectionKey: `${user.id}:${savedPoolId}`
      }
      if (protectAll || referencedIds.has(savedPoolId)) referenced.push(item)
      else orphaned.push(item)
    }

    return {
      id: user.id,
      name: user.name,
      orphaned,
      referenced
    }
  }).filter(group => group.orphaned.length || group.referenced.length)
}

export function planOrphanDeletion (users, macros, selectedKeys) {
  const selected = new Set(selectedKeys ?? [])
  const scan = scanSavedPools(users, macros)
  const allowed = new Set(scan.flatMap(group => group.orphaned.map(recipe => recipe.selectionKey)))
  const updates = []
  let deleted = 0

  for (const user of Array.from(users ?? [])) {
    const savedPools = user.flags?.cortexprime?.savedPools ?? {}
    const retained = {}
    let changed = false
    for (const [savedPoolId, recipe] of Object.entries(savedPools)) {
      const key = `${user.id}:${savedPoolId}`
      if (selected.has(key) && allowed.has(key)) {
        changed = true
        deleted++
      } else retained[savedPoolId] = recipe
    }
    if (changed) updates.push({ user, savedPools: retained })
  }

  return { deleted, updates }
}
