const VALUE_TYPES = new Set(['die', 'number', 'text'])

const clone = value => {
  if (Array.isArray(value)) return value.map(clone)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]))
}

const sourceMetadata = (sourcePath, formPath, collectionPath, formCollectionPath, sourceKey, compatibility = false, valueTypeExplicit = false) => ({
  collectionPath,
  compatibility,
  formCollectionPath,
  formPath,
  sourceKey,
  sourcePath,
  valueTypeExplicit
})

const normalizeValueType = valueType => valueType === 'dice'
  ? 'die'
  : VALUE_TYPES.has(valueType)
    ? valueType
    : 'die'

export const LEGACY_SIMPLE_TRAIT_LAYOUT_ID = 'simpleTraits'

const findById = (collection, id) => id == null
  ? undefined
  : Object.values(collection ?? {}).find(item => item?.id === id)

const findLegacyById = (collection, id) => id == null
  ? undefined
  : Object.values(collection ?? {}).find(item => item?.id === id || item?.dice?.id === id)

const mapCollection = (collection, callback) => Object.fromEntries(
  Object.entries(collection ?? {}).map(([key, value]) => [key, callback(value, key)])
)

/** Merge refreshed Actor Type configuration with an actor's local values. */
export function mergeActorTypeSettings (actorDataInput, actorTypeSettingsInput) {
  const actorData = clone(actorDataInput ?? {})
  const actorTypeSettings = clone(actorTypeSettingsInput ?? {})
  const merged = { ...actorData, ...actorTypeSettings }

  if (actorTypeSettings.simpleTraits) {
    merged.simpleTraits = mapCollection(actorTypeSettings.simpleTraits, (configured, key) => {
      const local = findById(actorData.simpleTraits, configured.id) ??
        actorData.simpleTraits?.[key] ??
        findLegacyById(actorData.simpleTraits, configured.dice?.id) ?? {}

      return {
        ...configured,
        ...local,
        id: configured.id ?? local.id,
        label: configured.label,
        hasDescription: configured.hasDescription,
        settings: configured.settings,
        ...((configured.text || local.text) ? { text: local.text ?? configured.text } : {}),
        ...((configured.number || local.number) ? { number: local.number ?? configured.number } : {}),
        ...((configured.dice || local.dice) ? {
          dice: {
            ...(configured.dice ?? {}),
            ...(local.dice ?? {}),
            value: local.dice?.value ?? configured.dice?.value
          }
        } : {})
      }
    })
  }

  if (actorTypeSettings.traitSets) merged.traitSets = mapCollection(actorTypeSettings.traitSets, configuredSet => {
    const localSet = findById(actorData.traitSets, configuredSet.id) ?? {}
    return {
      ...configuredSet,
      ...localSet,
      id: configuredSet.id,
      label: configuredSet.label,
      tabId: configuredSet.tabId,
      hasDescription: configuredSet.hasDescription,
      settings: configuredSet.settings,
      traits: mapCollection(configuredSet.traits, configuredTrait => {
        const localTrait = findById(localSet.traits, configuredTrait.id) ?? {}
        return {
          ...configuredTrait,
          ...localTrait,
          id: configuredTrait.id,
          name: configuredTrait.name,
          valueType: normalizeValueType(configuredTrait.valueType),
          valueSettings: configuredTrait.valueSettings ?? localTrait.valueSettings
        }
      })
    }
  })

  return merged
}

export function normalizeActorType (input, {
  formPath = 'system.actorType',
  legacyLabel = 'Simple Traits',
  sourcePath = 'system.actorType'
} = {}) {
  const actorType = clone(input ?? {})
  const traitSets = actorType.traitSets ?? {}

  for (const [traitSetKey, traitSet] of Object.entries(traitSets)) {
    const traitSetSourcePath = `${sourcePath}.traitSets.${traitSetKey}`
    const traitSetFormPath = `${formPath}.traitSets.${traitSetKey}`

    for (const target of ['traits', 'customTraits']) {
      for (const [traitKey, trait] of Object.entries(traitSet[target] ?? {})) {
        const collectionPath = `${traitSetSourcePath}.${target}`
        const formCollectionPath = `${traitSetFormPath}.${target}`
        const valueTypeExplicit = Object.hasOwn(trait, 'valueType')
        trait.valueType = normalizeValueType(trait.valueType)
        trait.valueSettings = {
          ...(trait.valueSettings ?? {}),
          consumableDice: trait.valueSettings?.consumableDice ?? traitSet.settings?.diceConsumable ?? traitSet.settings?.consumableDice ?? false
        }
        trait._source = sourceMetadata(
          `${collectionPath}.${traitKey}`,
          `${formCollectionPath}.${traitKey}`,
          collectionPath,
          formCollectionPath,
          traitKey,
          false,
          valueTypeExplicit
        )
      }
    }
  }

  const legacySimpleTraits = actorType.simpleTraits ?? {}
  if (!Object.keys(legacySimpleTraits).length) return actorType

  const baseSyntheticId = `legacy-simple-traits:${actorType.id ?? 'actor-type'}`
  const existingIds = new Set(Object.values(traitSets).map(traitSet => traitSet.id))
  let syntheticId = baseSyntheticId
  let collision = 1
  while (existingIds.has(syntheticId)) syntheticId = `${baseSyntheticId}:${collision++}`

  let syntheticKey = '__legacySimpleTraits'
  let keyCollision = 1
  while (Object.hasOwn(traitSets, syntheticKey)) syntheticKey = `__legacySimpleTraits${keyCollision++}`

  const legacySourceCollectionPath = `${sourcePath}.simpleTraits`
  const legacyFormCollectionPath = `${formPath}.simpleTraits`
  const syntheticTraits = Object.fromEntries(Object.entries(legacySimpleTraits).map(([legacyKey, legacyTrait]) => {
    const legacyValueType = legacyTrait.settings?.valueType ?? 'text'
    const valueType = normalizeValueType(legacyValueType)
    const id = legacyTrait.id ?? legacyTrait.dice?.id ?? `legacy-simple-trait:${actorType.id ?? 'actor-type'}:${legacyKey}`

    return [legacyKey, {
      ...legacyTrait,
      _source: sourceMetadata(
        `${legacySourceCollectionPath}.${legacyKey}`,
        `${legacyFormCollectionPath}.${legacyKey}`,
        legacySourceCollectionPath,
        legacyFormCollectionPath,
        legacyKey,
        true,
        true
      ),
      hasDescription: legacyTrait.hasDescription ?? false,
      id,
      name: legacyTrait.label ?? '',
      valueSettings: {
        hasMaxNumber: legacyTrait.settings?.hasMaxNumber ?? false,
        consumableDice: legacyTrait.settings?.consumableDice ?? legacyTrait.settings?.diceConsumable ?? false
      },
      valueType
    }]
  }))

  traitSets[syntheticKey] = {
    _compatibility: {
      layoutId: LEGACY_SIMPLE_TRAIT_LAYOUT_ID,
      source: 'simpleTraits'
    },
    hasDescription: false,
    id: syntheticId,
    label: legacyLabel,
    tabId: actorType.sectionLayout?.[LEGACY_SIMPLE_TRAIT_LAYOUT_ID]?.tabId ?? actorType.sectionTabs?.[LEGACY_SIMPLE_TRAIT_LAYOUT_ID],
    settings: {
      diceConsumable: false,
      hasDescription: false,
      hasDescriptors: false,
      hasDice: true,
      hasLabel: false,
      hasSfx: false,
      hasSubTraits: false
    },
    traits: syntheticTraits
  }

  actorType.traitSets = traitSets
  actorType.sectionLayout = {
    ...(actorType.sectionLayout ?? {}),
    [syntheticId]: {
      ...(actorType.sectionLayout?.[LEGACY_SIMPLE_TRAIT_LAYOUT_ID] ?? {}),
      compatibilityLayoutId: LEGACY_SIMPLE_TRAIT_LAYOUT_ID
    }
  }

  return actorType
}
