const PRESENTATION_MODES = {
  die: new Set(['none', 'icon', 'addToPool']),
  number: new Set(['none', 'icon']),
  resource: new Set(['none', 'icon', 'consume']),
  text: new Set(['none', 'icon'])
}

export function getTraitPresentation (trait = {}) {
  const settings = trait.valueType === 'resource' ? trait.valueSettings : trait.presentation
  const image = typeof settings?.image === 'string' ? settings.image : ''
  const hasImage = trait.valueType === 'resource' ? Boolean(image) : Boolean(image.trim())
  const allowedModes = PRESENTATION_MODES[trait.valueType] ?? PRESENTATION_MODES.text
  const requestedDisplay = allowedModes.has(settings?.imageDisplay) ? settings.imageDisplay : 'none'
  const imageDisplay = hasImage || requestedDisplay === 'none' ? requestedDisplay : 'none'

  return {
    hasImage,
    image,
    imageDisplay,
    showIcon: hasImage && imageDisplay === 'icon',
    useConsumeImage: hasImage && imageDisplay === 'consume',
    useImageAction: hasImage && imageDisplay === 'addToPool'
  }
}

/** Avoid persisting empty presentation defaults merely because a form was opened. */
export function pruneImplicitTraitPresentation (submitted, current) {
  if (!submitted || typeof submitted !== 'object') return submitted

  if (submitted.presentation) {
    const currentPresentation = current?.presentation ?? {}
    if (submitted.presentation.image === '' && !Object.hasOwn(currentPresentation, 'image')) {
      delete submitted.presentation.image
    }
    if (submitted.presentation.imageDisplay === 'none' && !Object.hasOwn(currentPresentation, 'imageDisplay')) {
      delete submitted.presentation.imageDisplay
    }
    if (!Object.keys(submitted.presentation).length && !Object.hasOwn(current ?? {}, 'presentation')) {
      delete submitted.presentation
    }
  }

  for (const [key, value] of Object.entries(submitted)) {
    if (value && typeof value === 'object') pruneImplicitTraitPresentation(value, current?.[key])
  }
  return submitted
}
