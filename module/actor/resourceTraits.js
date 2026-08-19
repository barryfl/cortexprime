export const RESOURCE_IMAGE_DISPLAYS = new Set(['none', 'icon', 'consume'])

const optionalNumber = value => {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function normalizeResourceSettings (settings = {}) {
  const min = optionalNumber(settings.min) ?? 0
  const configuredMax = optionalNumber(settings.max)
  const max = configuredMax === null ? null : Math.max(min, configuredMax)
  const configuredStep = optionalNumber(settings.step)
  const step = configuredStep !== null && configuredStep > 0 ? configuredStep : 1
  const configuredDefault = optionalNumber(settings.default) ?? 0
  const defaultValue = clampResourceValue(configuredDefault, { min, max })

  return {
    default: defaultValue,
    image: typeof settings.image === 'string' ? settings.image : '',
    imageDisplay: RESOURCE_IMAGE_DISPLAYS.has(settings.imageDisplay) ? settings.imageDisplay : 'none',
    max,
    min,
    step
  }
}

export function clampResourceValue (value, settings = {}) {
  const number = optionalNumber(value) ?? 0
  const min = optionalNumber(settings.min) ?? 0
  const max = optionalNumber(settings.max)
  return Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, number))
}

export function currentResourceValue (trait) {
  const settings = normalizeResourceSettings(trait?.valueSettings)
  const current = Object.hasOwn(trait?.resource ?? {}, 'value')
    ? trait.resource.value
    : settings.default
  return optionalNumber(current) ?? settings.default
}

export function changeResourceValue (trait, direction) {
  const settings = normalizeResourceSettings(trait?.valueSettings)
  return clampResourceValue(currentResourceValue(trait) + (Number(direction) * settings.step), settings)
}

export function prepareResourceView (trait) {
  const settings = normalizeResourceSettings(trait?.valueSettings)
  const value = currentResourceValue(trait)
  const hasImage = Boolean(settings.image)
  const imageDisplay = settings.imageDisplay === 'consume' && !hasImage ? 'none' : settings.imageDisplay

  return {
    canDecrement: value > settings.min,
    canIncrement: settings.max === null || value < settings.max,
    hasImage,
    hasMax: settings.max !== null,
    image: settings.image,
    imageDisplay,
    max: settings.max,
    min: settings.min,
    step: settings.step,
    value
  }
}

export function initializeResourceTrait (trait) {
  if (trait?.valueType !== 'resource') return trait
  const resource = { ...(trait.resource ?? {}) }
  if (!Object.hasOwn(resource, 'value')) resource.value = normalizeResourceSettings(trait.valueSettings).default
  return { ...trait, resource }
}

export function initializeActorTypeResources (actorType) {
  const initialized = structuredClone(actorType ?? {})
  for (const traitSet of Object.values(initialized.traitSets ?? {})) {
    for (const target of ['traits', 'customTraits']) {
      for (const [key, trait] of Object.entries(traitSet[target] ?? {})) {
        traitSet[target][key] = initializeResourceTrait(trait)
      }
    }
  }
  return initialized
}

export function isResourceTraitPath (path) {
  return /^system\.actorType\.traitSets\.[^.]+\.(traits|customTraits)\.[^.]+$/.test(path ?? '')
}

/** Avoid persisting runtime defaults merely because a Resource form was opened. */
export function pruneImplicitResourceSettings (submitted, current) {
  if (!submitted || typeof submitted !== 'object') return submitted

  if (submitted.valueType === 'resource' && submitted.valueSettings) {
    const currentSettings = current?.valueSettings ?? {}
    for (const key of ['min', 'max', 'default', 'step', 'image']) {
      if (submitted.valueSettings[key] === '' && !Object.hasOwn(currentSettings, key)) delete submitted.valueSettings[key]
    }
    if (submitted.valueSettings.imageDisplay === 'none' && !Object.hasOwn(currentSettings, 'imageDisplay')) {
      delete submitted.valueSettings.imageDisplay
    }
  }

  for (const [key, value] of Object.entries(submitted)) {
    if (value && typeof value === 'object') pruneImplicitResourceSettings(value, current?.[key])
  }
  return submitted
}
