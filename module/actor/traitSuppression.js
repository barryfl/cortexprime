const clone = value => {
  if (Array.isArray(value)) return value.map(clone)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]))
}

export const traitSuppressionKey = (traitSet, trait) => {
  if (!traitSet?.id || !trait?.id) return null
  return `trait:${encodeURIComponent(traitSet.id)}:${encodeURIComponent(trait.id)}`
}

export const findSuppressibleTrait = (actorType, suppressionKey) => {
  for (const traitSet of Object.values(actorType?.traitSets ?? {})) {
    for (const trait of Object.values(traitSet?.traits ?? {})) {
      if (traitSuppressionKey(traitSet, trait) === suppressionKey) return { trait, traitSet }
    }
  }
  return null
}

/** Build a suppression-aware Actor Sheet view model without mutating stored data. */
export const prepareTraitSuppressions = input => {
  const actorType = clone(input ?? {})
  const suppressedTraits = actorType.suppressedTraits ?? {}

  for (const traitSet of Object.values(actorType.traitSets ?? {})) {
    const visible = []
    const suppressed = []

    for (const [traitKey, trait] of Object.entries(traitSet.traits ?? {})) {
      const suppressionId = traitSuppressionKey(traitSet, trait)
      const entry = [traitKey, { ...trait, _suppressionId: suppressionId }]
      if (suppressionId && suppressedTraits[suppressionId] === true) suppressed.push(entry)
      else visible.push(entry)
    }

    traitSet.traits = Object.fromEntries(visible)
    if (suppressed.length) traitSet._suppressedTraits = Object.fromEntries(suppressed)
    else delete traitSet._suppressedTraits
  }

  return actorType
}

export const withTraitSuppressed = (suppressedTraits, suppressionKey) => ({
  ...(suppressedTraits ?? {}),
  [suppressionKey]: true
})

export const withTraitRestored = (suppressedTraits, suppressionKey) => Object.fromEntries(
  Object.entries(suppressedTraits ?? {}).filter(([key]) => key !== suppressionKey)
)
