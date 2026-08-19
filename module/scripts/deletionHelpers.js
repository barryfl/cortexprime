/** Rebuild an indexed object after removing one key. */
export const removeIndexedItem = (collection = {}, itemKey) => Object.fromEntries(
  Object.entries(collection)
    .filter(([key]) => Number(key) !== Number(itemKey))
    .map(([, value], index) => [index, value])
)

const getPath = (object, path) => path
  .split('.')
  .filter(Boolean)
  .reduce((value, key) => value?.[key], object)

const setPath = (object, path, value) => {
  const keys = path.split('.').filter(Boolean)
  const finalKey = keys.pop()
  const parent = keys.reduce((current, key) => (current[key] ??= {}), object)
  parent[finalKey] = value
}

/**
 * Remove one item from a settings collection without mutating the supplied settings.
 * Trait Set removal also removes its stable-ID section placement configuration.
 */
export const removeSettingItem = (source, group, itemKey) => {
  const settings = structuredClone(source ?? {})
  const collection = group ? getPath(settings, group) : settings
  const removedItem = collection?.[itemKey]
  const remaining = removeIndexedItem(collection, itemKey)

  if (group) {
    setPath(settings, group, remaining)
    if (group.endsWith('.traitSets') && removedItem?.id) {
      const actorTypeKey = group.split('.')[0]
      delete settings[actorTypeKey]?.sectionLayout?.[removedItem.id]
    }
    return { settings, removedItem }
  }

  return { settings: remaining, removedItem }
}

const actorLocalTargets = new Set([
  'assets',
  'complications',
  'customTraits',
  'descriptors',
  'notes',
  'sfx',
  'subTraits'
])

/** Restrict Actor Sheet removal to collections which are actor-owned state. */
export const isActorLocalRemoval = (path, target) => (
  typeof path === 'string' &&
  path.startsWith('system.actorType') &&
  actorLocalTargets.has(target)
)
