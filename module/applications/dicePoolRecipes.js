import { normalizeActorType } from '../actor/normalizeActorType.js'
import { traitSuppressionKey } from '../actor/traitSuppression.js'
import { getEffectiveTraitDice } from '../actor/temporaryTraitSteps.js'

const clone = value => {
  if (Array.isArray(value)) return value.map(clone)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]))
}

const entries = collection => Object.values(collection ?? {})

const traitDisplayLabel = (traitSet, trait) => (
  traitSet?.settings?.hasLabel && trait?.label ? trait.label : trait?.name
)

export { getEffectiveTraitDice }

export function findActorTrait (actorType, traitSetId, traitId) {
  const traitSet = entries(actorType?.traitSets).find(candidate => candidate?.id === traitSetId)
  if (!traitSet) return null
  const trait = entries(traitSet.traits).find(candidate => candidate?.id === traitId) ??
    entries(traitSet.customTraits).find(candidate => candidate?.id === traitId)
  return trait ? { trait, traitSet } : null
}

export function createActorTraitProvenance (actor, dicePath, legacyLabel = 'Simple Traits') {
  const traitPath = dicePath?.endsWith('.dice') ? dicePath.slice(0, -5) : dicePath
  if (!actor?.uuid || !traitPath) return null

  const actorType = normalizeActorType(actor.system?.actorType, { legacyLabel })
  for (const traitSet of entries(actorType.traitSets)) {
    for (const trait of [...entries(traitSet.traits), ...entries(traitSet.customTraits)]) {
      if (trait?._source?.formPath !== traitPath || !traitSet.id || !trait.id || trait.valueType !== 'die') continue
      return {
        type: 'actorTrait',
        actorUuid: actor.uuid,
        traitId: trait.id,
        traitSetId: traitSet.id
      }
    }
  }
  return null
}

export function createSavedPoolRecipe (pool, { id, name }) {
  const recipeEntries = []
  for (const [source, sourcePool] of Object.entries(pool ?? {})) {
    for (const entry of Object.values(sourcePool ?? {})) {
      if (entry.provenance?.type === 'actorTrait') {
        recipeEntries.push({
          ...clone(entry.provenance),
          label: entry.label ?? '',
          source
        })
      } else {
        recipeEntries.push({
          type: 'literal',
          label: entry.label ?? '',
          source,
          value: clone(entry.value ?? {})
        })
      }
    }
  }
  return { id, name, version: 1, entries: recipeEntries }
}

export const createSavedPoolMacroData = (name, savedPoolId, userId, {
  folderId,
  ownerLevel = 3
} = {}) => ({
  name,
  type: 'script',
  command: `return game.cortexprime.loadSavedPool(${JSON.stringify(savedPoolId)});`,
  flags: {
    cortexprime: {
      ownerUserId: userId,
      savedPoolId,
      savedPoolMacro: true
    }
  },
  ...(folderId ? { folder: folderId } : {}),
  ownership: { [userId]: ownerLevel }
})

const appendPoolEntry = (pool, source, entry) => {
  const sourcePool = pool[source] ?? {}
  pool[source] = { ...sourcePool, [Object.keys(sourcePool).length]: entry }
}

export async function resolveSavedPoolRecipe (recipe, {
  legacyLabel = 'Simple Traits',
  resolveActor
} = {}) {
  const pool = {}
  const unavailable = []

  for (const entry of recipe?.entries ?? []) {
    if (entry.type === 'literal') {
      appendPoolEntry(pool, entry.source || 'Custom', {
        label: entry.label ?? '',
        value: clone(entry.value ?? {})
      })
      continue
    }

    if (entry.type !== 'actorTrait') continue
    const actor = await resolveActor?.(entry.actorUuid)
    if (!actor) {
      unavailable.push(entry.label || entry.actorUuid)
      continue
    }

    const actorType = normalizeActorType(actor.system?.actorType, { legacyLabel })
    const match = findActorTrait(actorType, entry.traitSetId, entry.traitId)
    const suppressionId = match && traitSuppressionKey(match.traitSet, match.trait)
    const suppressed = suppressionId && actor.system?.actorType?.suppressedTraits?.[suppressionId] === true
    const unavailableState = match?.trait?.shutdown || match?.traitSet?.shutdown
    const value = match && !suppressed && !unavailableState ? getEffectiveTraitDice(match.trait) : {}

    if (!match || suppressed || !Object.keys(value).length) {
      unavailable.push((match && traitDisplayLabel(match.traitSet, match.trait)) || entry.label || entry.traitId)
      continue
    }

    appendPoolEntry(pool, actor.name || entry.source, {
      label: traitDisplayLabel(match.traitSet, match.trait) || entry.label || '',
      provenance: {
        type: 'actorTrait',
        actorUuid: entry.actorUuid,
        traitId: entry.traitId,
        traitSetId: entry.traitSetId
      },
      value
    })
  }

  return { pool, unavailable }
}
