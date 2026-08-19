import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('die and Trait actions expose concise accessible labels', () => {
  const dice = read('templates/partials/dice/select.html')
  const temporary = read('templates/partials/actor-sheet/temporary-die.html')
  const traits = read('templates/partials/actor-sheet/traits.html')
  const sheet = read('templates/actor/actor-sheet.html')

  assert.match(dice, /title="\{\{localize 'ChangePermanentDie'\}\}"/)
  assert.match(traits, /title="\{\{localize 'AddToDicePool'\}\}"/)
  for (const key of ['TemporaryStepDown', 'ResetTemporaryTraitStep', 'TemporaryStepUp']) {
    assert.match(temporary, new RegExp(`title="\\{\\{localize '${key}'\\}\\}"`))
    assert.match(temporary, new RegExp(`aria-label="\\{\\{localize '${key}'\\}\\}"`))
  }
  assert.match(sheet, /ResetAllTemporaryTraitSteps/)
  assert.match(sheet, /CortexPrimeSystemGuide/)
  assert.match(traits, /HideTraitOnActor/)
})

test('Add to Pool indicator uses a supported text glyph rather than unavailable Font Awesome content', () => {
  const styles = read('scss/global/_misc.scss')
  const addRule = styles.match(/\.add-to-pool \{[\s\S]*?\n\}/)?.[0] ?? ''
  assert.match(addRule, /content: "\+"/)
  assert.doesNotMatch(addRule, /f522|Font Awesome 6 Pro/)
})

test('Plot Points render as one compact icon, decrement, value, increment control group', () => {
  const plotPoints = read('templates/partials/pp.html')
  const styles = read('scss/global/_misc.scss')
  assert.match(plotPoints, /pp-controls-cpt[\s\S]*plot-point\.html[\s\S]*data-action="spendPp"[\s\S]*pp-number-field[\s\S]*data-action="addPp"/)
  assert.match(styles, /\.pp-controls-cpt/)
  assert.doesNotMatch(plotPoints, /pp-number-field flex-col col-6/)
})

test('Welcome reuses the existing first-run setting and offers Help, dismissal, and later actions', () => {
  const hooks = read('module/cortexPrimeHooks.js')
  assert.match(hooks, /game\.settings\.get\('cortexprime', 'WelcomeSeen'\)/)
  assert.match(hooks, /DialogV2\.wait/)
  assert.match(hooks, /action: 'help'/)
  assert.match(hooks, /action: 'dismiss'/)
  assert.match(hooks, /action: 'later'/)
  assert.match(hooks, /new CortexPrimeHelp/)
})

test('Help covers the newer player workflows', () => {
  const traits = read('templates/help/traits.html')
  const pools = read('templates/help/dice-pools.html')
  for (const heading of ['Permanent vs Temporary Die Values', 'Hiding and Restoring Traits', 'Resource Traits']) {
    assert.match(traits, new RegExp(heading))
  }
  assert.match(traits, /Custom Traits/)
  assert.match(pools, /temporary staging tray/)
  assert.match(pools, /Export to Macro/)
  assert.match(pools, /current effective values/)
})
