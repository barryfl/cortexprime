export const TRAIT_DIE_LADDER = ['4', '6', '8', '10', '12']

const cloneDice = dice => Object.fromEntries(Object.entries(dice ?? {}).map(([key, value]) => [key, value]))

export const normalizeTemporaryStep = value => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

export const stepDie = (die, steps = 0) => {
  const value = String(die ?? '')
  const index = TRAIT_DIE_LADDER.indexOf(value)
  if (index < 0) return value
  const target = Math.max(0, Math.min(TRAIT_DIE_LADDER.length - 1, index + normalizeTemporaryStep(steps)))
  return TRAIT_DIE_LADDER[target]
}

export const getEffectiveTraitDice = trait => {
  if (trait?.valueType !== 'die') return {}
  const adjustment = normalizeTemporaryStep(trait.temporaryStep)
  return Object.fromEntries(Object.entries(trait.dice?.value ?? {}).map(([key, die]) => [key, stepDie(die, adjustment)]))
}

export const clampTemporaryStep = (trait, requestedStep) => {
  const baseDie = Object.values(trait?.dice?.value ?? {}).find(die => TRAIT_DIE_LADDER.includes(String(die)))
  if (baseDie === undefined) return 0
  const baseIndex = TRAIT_DIE_LADDER.indexOf(String(baseDie))
  const clamped = Math.max(-baseIndex, Math.min(TRAIT_DIE_LADDER.length - 1 - baseIndex, normalizeTemporaryStep(requestedStep)))
  return clamped === 0 ? 0 : clamped
}

export const changeTemporaryStep = (trait, direction) => {
  if (direction === 'reset') return 0
  const delta = direction === 'up' ? 1 : direction === 'down' ? -1 : 0
  return clampTemporaryStep(trait, normalizeTemporaryStep(trait?.temporaryStep) + delta)
}

export const prepareTemporaryDieView = trait => {
  if (trait?.valueType !== 'die') return null
  const adjustment = normalizeTemporaryStep(trait.temporaryStep)
  const baseDice = cloneDice(trait.dice?.value)
  const effectiveDice = getEffectiveTraitDice(trait)
  const nextDown = changeTemporaryStep(trait, 'down')
  const nextUp = changeTemporaryStep(trait, 'up')
  return {
    adjusted: adjustment !== 0,
    adjustment,
    adjustmentLabel: adjustment > 0 ? `+${adjustment}` : String(adjustment),
    baseDice,
    canStepDown: nextDown !== adjustment,
    canStepUp: nextUp !== adjustment,
    effectiveDice
  }
}

export function findTraitByFormPath (actorType, formPath) {
  for (const traitSet of Object.values(actorType?.traitSets ?? {})) {
    for (const trait of [...Object.values(traitSet.traits ?? {}), ...Object.values(traitSet.customTraits ?? {})]) {
      if (trait?._source?.formPath === formPath) return trait
    }
  }
  return null
}

export function collectAdjustedTraitPaths (actorType) {
  const paths = []
  for (const traitSet of Object.values(actorType?.traitSets ?? {})) {
    for (const trait of [...Object.values(traitSet.traits ?? {}), ...Object.values(traitSet.customTraits ?? {})]) {
      if (trait?.valueType === 'die' && normalizeTemporaryStep(trait.temporaryStep) !== 0 && trait._source?.formPath) {
        paths.push(trait._source.formPath)
      }
    }
  }
  return paths
}
