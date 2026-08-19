/**
 * Existing Trait Sets predate an explicit custom-Trait permission and allowed
 * actor owners to create custom Traits. Preserve that behavior when the setting
 * is absent.
 */
export function traitSetAllowsCustomTraits (traitSet) {
  return traitSet?.settings?.allowCustomTraits !== false
}

export function canCreateCustomTrait (traitSet, {
  isEditable = true,
  isGM = false,
  isOwner = false
} = {}) {
  if (!isEditable) return false
  if (isGM) return true
  return isOwner && traitSetAllowsCustomTraits(traitSet)
}

export function appendCustomTrait (customTraits, trait) {
  const current = customTraits ?? {}
  return {
    ...current,
    [Object.keys(current).length]: trait
  }
}
