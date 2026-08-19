export const PREDEFINED_ACTOR_SHEET_SECTIONS = Object.freeze([
  { id: 'profile', label: 'ProfileIdentity' },
  { feature: 'hasPlotPoints', id: 'plotPoints', label: 'PlotPoints' },
  { feature: 'hasAssets', id: 'assets', label: 'Assets' },
  { feature: 'hasComplications', id: 'complications', label: 'Complications' }
])

export function isPredefinedSectionAvailable (actorType, sectionId) {
  const section = PREDEFINED_ACTOR_SHEET_SECTIONS.find(candidate => candidate.id === sectionId)
  if (!section) return true
  return !section.feature || Boolean(actorType?.[section.feature])
}

export function isSectionPlacementEnabled (layout) {
  return layout?.enabled !== false
}

export function shouldRenderSection (actorType, { id, type }) {
  if (type !== 'traitSet' && !isPredefinedSectionAvailable(actorType, id)) return false
  return isSectionPlacementEnabled(actorType?.sectionLayout?.[id])
}

export function filterRenderableSections (actorType, sections) {
  return sections.filter(section => shouldRenderSection(actorType, section))
}

export function withSectionPlacementEnabled (actorType, sectionId, enabled) {
  return {
    ...actorType,
    sectionLayout: {
      ...(actorType?.sectionLayout ?? {}),
      [sectionId]: {
        ...(actorType?.sectionLayout?.[sectionId] ?? {}),
        enabled
      }
    }
  }
}

export function updateBreadcrumbName (breadcrumbs, target, value) {
  return Object.fromEntries(Object.entries(breadcrumbs ?? {}).map(([key, breadcrumb]) => [key, {
    ...breadcrumb,
    ...(breadcrumb.target === target ? { name: value } : {})
  }]))
}
