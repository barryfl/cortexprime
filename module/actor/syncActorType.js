import { initializeResourceTrait } from './resourceTraits.js'

const clone = value => {
  if (Array.isArray(value)) return value.map(clone)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]))
}

const hasOwn = (object, key) => Object.hasOwn(object ?? {}, key)

const identity = (value, key) => value?.id ?? `key:${key}`
const legacySimpleIdentity = (value, key) => value?.id ?? value?.dice?.id ?? `key:${key}`

const mergeOrderedUnion = (actorCollection, templateCollection, mergeMatch, getIdentity = identity, createTemplate = clone) => {
  const actorEntries = Object.entries(actorCollection ?? {})
  const usedActorKeys = new Set()
  const values = []

  for (const [templateKey, templateValue] of Object.entries(templateCollection ?? {})) {
    const templateIdentity = getIdentity(templateValue, templateKey)
    const match = actorEntries.find(([actorKey, actorValue]) => (
      !usedActorKeys.has(actorKey) && getIdentity(actorValue, actorKey) === templateIdentity
    ))

    if (match) {
      usedActorKeys.add(match[0])
      values.push(mergeMatch(match[1], templateValue))
    } else {
      values.push(createTemplate(templateValue))
    }
  }

  for (const [actorKey, actorValue] of actorEntries) {
    if (!usedActorKeys.has(actorKey)) values.push(clone(actorValue))
  }

  return Object.fromEntries(values.map((value, index) => [index, value]))
}

const mergeKeyedConfiguration = (actorCollection, templateCollection) => {
  const merged = clone(actorCollection ?? {})
  for (const [key, templateValue] of Object.entries(templateCollection ?? {})) {
    const actorValue = merged[key]
    merged[key] = actorValue && templateValue && typeof actorValue === 'object' && typeof templateValue === 'object'
      ? { ...actorValue, ...clone(templateValue) }
      : clone(templateValue)
  }
  return merged
}

const mergeCurrentValue = (actorValue, templateValue, valueKey = 'value') => {
  if (!actorValue && !templateValue) return undefined
  const merged = { ...(actorValue ?? {}), ...(templateValue ?? {}) }
  if (hasOwn(actorValue, valueKey)) merged[valueKey] = clone(actorValue[valueKey])
  for (const stateKey of ['consumable', 'spent']) {
    if (hasOwn(actorValue, stateKey)) merged[stateKey] = clone(actorValue[stateKey])
  }
  return merged
}

const mergeNestedDefinition = (actorValue, templateValue) => {
  const merged = { ...(actorValue ?? {}), ...(templateValue ?? {}) }
  if (actorValue?.dice || templateValue?.dice) merged.dice = mergeCurrentValue(actorValue?.dice, templateValue?.dice)
  if (hasOwn(actorValue, 'unlocked')) merged.unlocked = actorValue.unlocked
  return merged
}

const mergeNestedDefinitions = (actorCollection, templateCollection) => mergeOrderedUnion(
  actorCollection,
  templateCollection,
  mergeNestedDefinition
)

const mergePresetTrait = (actorTrait, templateTrait, preserveActorLabel = false) => {
  const merged = { ...clone(actorTrait), ...clone(templateTrait) }

  if (preserveActorLabel && hasOwn(actorTrait, 'label')) merged.label = actorTrait.label
  for (const stateKey of ['edit', 'hidden', 'shutdown']) {
    if (hasOwn(actorTrait, stateKey)) merged[stateKey] = actorTrait[stateKey]
  }

  merged.dice = mergeCurrentValue(actorTrait?.dice, templateTrait?.dice)
  merged.number = mergeCurrentValue(actorTrait?.number, templateTrait?.number)
  merged.text = mergeCurrentValue(actorTrait?.text, templateTrait?.text)
  merged.resource = mergeCurrentValue(actorTrait?.resource, templateTrait?.resource)

  if (actorTrait?.descriptors || templateTrait?.descriptors) {
    merged.descriptors = mergeNestedDefinitions(actorTrait?.descriptors, templateTrait?.descriptors)
  }
  if (actorTrait?.sfx || templateTrait?.sfx) {
    merged.sfx = mergeNestedDefinitions(actorTrait?.sfx, templateTrait?.sfx)
  }
  if (actorTrait?.subTraits || templateTrait?.subTraits) {
    merged.subTraits = mergeNestedDefinitions(actorTrait?.subTraits, templateTrait?.subTraits)
  }

  if (merged.valueType === 'resource' && !hasOwn(merged.resource, 'value')) {
    merged.resource = initializeResourceTrait(merged).resource
  }

  for (const key of ['dice', 'number', 'resource', 'text']) {
    if (merged[key] === undefined) delete merged[key]
  }
  return merged
}

const mergeTraitSet = (actorSet, templateSet) => {
  const merged = { ...clone(actorSet), ...clone(templateSet) }
  if (hasOwn(actorSet, 'shutdown')) merged.shutdown = actorSet.shutdown
  if (actorSet?.customTraits) merged.customTraits = clone(actorSet.customTraits)
  merged.traits = mergeOrderedUnion(
    actorSet?.traits,
    templateSet?.traits,
    (actorTrait, templateTrait) => mergePresetTrait(actorTrait, templateTrait, templateSet?.settings?.hasLabel),
    identity,
    initializeResourceTrait
  )
  return merged
}

const mergeLegacySimpleTrait = (actorTrait, templateTrait) => {
  const merged = { ...clone(actorTrait), ...clone(templateTrait) }
  for (const stateKey of ['edit', 'hidden']) {
    if (hasOwn(actorTrait, stateKey)) merged[stateKey] = actorTrait[stateKey]
  }
  merged.dice = mergeCurrentValue(actorTrait?.dice, templateTrait?.dice)
  merged.number = mergeCurrentValue(actorTrait?.number, templateTrait?.number)
  merged.text = mergeCurrentValue(actorTrait?.text, templateTrait?.text)
  for (const key of ['dice', 'number', 'text']) {
    if (merged[key] === undefined) delete merged[key]
  }
  return merged
}

/**
 * Apply Actor Type configuration to actor-local Actor Type data without deleting
 * actor-only objects or resetting current values.
 */
export function mergeActorTypeConfiguration (actorTypeDataInput, actorTypeTemplateInput) {
  const actorTypeData = clone(actorTypeDataInput ?? {})
  const actorTypeTemplate = clone(actorTypeTemplateInput ?? {})
  const merged = { ...actorTypeData, ...actorTypeTemplate }

  merged.tabs = mergeOrderedUnion(actorTypeData.tabs, actorTypeTemplate.tabs, (actorTab, templateTab) => ({
    ...clone(actorTab),
    ...clone(templateTab)
  }))
  merged.sectionLayout = mergeKeyedConfiguration(actorTypeData.sectionLayout, actorTypeTemplate.sectionLayout)
  merged.sectionTabs = mergeKeyedConfiguration(actorTypeData.sectionTabs, actorTypeTemplate.sectionTabs)
  merged.traitSets = mergeOrderedUnion(actorTypeData.traitSets, actorTypeTemplate.traitSets, mergeTraitSet)

  if (actorTypeData.simpleTraits || actorTypeTemplate.simpleTraits) {
    merged.simpleTraits = mergeOrderedUnion(
      actorTypeData.simpleTraits,
      actorTypeTemplate.simpleTraits,
      mergeLegacySimpleTrait,
      legacySimpleIdentity
    )
  }

  for (const actorOwnedKey of ['assets', 'complications', 'notes', 'traitSetEdit']) {
    if (hasOwn(actorTypeData, actorOwnedKey)) merged[actorOwnedKey] = clone(actorTypeData[actorOwnedKey])
  }

  return merged
}

export function actorsMatchingActorType (actors, actorTypeId) {
  const actorList = actors?.contents ?? (typeof actors?.values === 'function' ? Array.from(actors.values()) : Array.from(actors ?? []))
  return actorList.filter(actor => actor?.system?.actorType?.id === actorTypeId)
}

export async function syncActorWithActorType (actor, actorTypeTemplate) {
  const actorTypeId = actor?.system?.actorType?.id
  if (!actorTypeId || actorTypeId !== actorTypeTemplate?.id) return false

  const actorType = mergeActorTypeConfiguration(actor.system.actorType, actorTypeTemplate)
  await actor.update({ 'system.actorType': actorType })
  return actorType
}

export async function syncActorsWithActorType (actorTypeTemplate, actors = globalThis.game?.actors ?? []) {
  const matchingActors = actorsMatchingActorType(actors, actorTypeTemplate?.id)
  for (const actor of matchingActors) await syncActorWithActorType(actor, actorTypeTemplate)
  return matchingActors
}
