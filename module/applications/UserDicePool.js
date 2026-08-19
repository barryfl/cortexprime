import { localizer } from '../scripts/foundryHelpers.js'
import { getLength, objectFilter, objectMapValues, objectReindexFilter } from '../../lib/helpers.js'
import rollDice from '../scripts/rollDice.js'
import { CortexPrimeApplication } from './CortexPrimeApplication.js'
import { completeDicePoolRoll, createBlankDicePool, resetUserDicePool } from './dicePoolLifecycle.js'

export class UserDicePool extends CortexPrimeApplication {
  static DEFAULT_OPTIONS = {
    id: 'user-dice-pool',
    tagName: 'form',
    classes: ['cortexprime', 'cortexprime-application', 'user-dice-pool'],
    actions: {
      addCustomTrait: function (event, target) { return this._addCustomTraitToPool(event, target) },
      clearPool: function (event, target) { return this._clearDicePool(event, target) },
      clearSource: function (event, target) { return this._clearSource(event, target) },
      newDie: function (event, target) { return this._onNewDie(event, target) },
      removePoolTrait: function (event, target) { return this._removePoolTrait(event, target) },
      resetCustomTrait: function (event, target) { return this._resetCustomPoolTrait(event, target) },
      rollPool: function (event, target) { return this._rollDicePool(event, target) }
    },
    form: {
      closeOnSubmit: false,
      handler: function () { return this._saveForm() }
    },
    position: {
      width: 600,
      height: 'auto',
      top: 500,
      left: 20
    }
  }

  static PARTS = {
    pool: {
      template: 'systems/cortexprime/templates/dice-pool.html'
    }
  }

  get title () {
    return localizer('DicePool')
  }

  async _prepareContext (options) {
    const context = await super._prepareContext(options)
    const dice = game.user.getFlag('cortexprime', 'dicePool') ?? createBlankDicePool()
    const themes = game.settings.get('cortexprime', 'themes')
    const theme = themes.current === 'custom' ? themes.custom : themes.list[themes.current]
    return { ...context, ...dice, theme }
  }

  async _saveForm () {
    const form = this.element.matches('form') ? this.element : this.element.querySelector('form')
    if (!form) return

    const currentDice = this._getDicePool()
    const formData = Object.fromEntries(new FormData(form).entries())
    const newDice = foundry.utils.mergeObject(currentDice, foundry.utils.expandObject(formData))

    await game.user.setFlag('cortexprime', 'dicePool', newDice)
  }

  async _onRender (context, options) {
    await super._onRender(context, options)

    this.element.querySelector('.custom-dice-label')?.addEventListener('change', () => this._saveForm())

    for (const select of this.element.querySelectorAll('.die-select')) {
      select.addEventListener('change', event => this._onDieChange(event))
      select.addEventListener('mouseup', event => this._onDieRemove(event))
    }
  }

  async initPool () {
    await this._resetDicePool({ rerender: false })
  }

  _getDicePool () {
    return foundry.utils.deepClone(game.user.getFlag('cortexprime', 'dicePool') ?? createBlankDicePool())
  }

  async _resetDicePool ({ rerender = true } = {}) {
    const blankPool = await resetUserDicePool(game.user)
    if (rerender && this.rendered) await this._renderPreservingScroll()
    return blankPool
  }

  async _addCustomTraitToPool (event) {
    event.preventDefault()

    const currentDice = this._getDicePool()
    const currentCustomLength = getLength(currentDice.pool.custom ?? {})

    foundry.utils.setProperty(currentDice, `pool.custom.${currentCustomLength}`, currentDice.customAdd)

    foundry.utils.setProperty(currentDice, `customAdd`, {
      label: '',
      value: { 0: '8' }
    })

    await game.user.setFlag('cortexprime', 'dicePool', null)

    await game.user.setFlag('cortexprime', 'dicePool', currentDice)

    await this._renderPreservingScroll()
  }

  async _addTraitToPool (source, label, value) {
    const currentDice = this._getDicePool()
    const currentDiceLength = getLength(currentDice.pool[source] || {})
    foundry.utils.setProperty(currentDice, `pool.${source}.${currentDiceLength}`, { label, value })

    await game.user.setFlag('cortexprime', 'dicePool', null)

    await game.user.setFlag('cortexprime', 'dicePool', currentDice)

    await this._renderPreservingScroll()
  }

  async _clearDicePool (event) {
    if (event) event.preventDefault()
    return this._resetDicePool()
  }

  async _clearSource (event, actionTarget = event.currentTarget) {
    event.preventDefault()
    const { source } = actionTarget.dataset
    const currentDice = this._getDicePool()

    await game.user.setFlag('cortexprime', 'dicePool', null)

    currentDice.pool = objectFilter(currentDice.pool, (_, dieSource) => source !== dieSource)

    await game.user.setFlag('cortexprime', 'dicePool', currentDice)

    await this._renderPreservingScroll()
  }

  async _onDieChange (event) {
    event.preventDefault()
    await this._saveForm()

    const currentDice = this._getDicePool()
    const { target, key: targetKey } = event.currentTarget.dataset
    const targetValue = event.currentTarget.value
    const dataTargetValue = foundry.utils.getProperty(currentDice, `${target}.value`) || {}

    await game.user.setFlag('cortexprime', 'dicePool', null)

    foundry.utils.setProperty(currentDice, `${target}.value`, objectMapValues(dataTargetValue, (value, index) => parseInt(index, 10) === parseInt(targetKey, 10) ? targetValue : value))

    await game.user.setFlag('cortexprime', 'dicePool', currentDice)

    await this._renderPreservingScroll()
  }

  async _onDieRemove (event) {
    event.preventDefault()

    if (event.button === 2) {
      await this._saveForm()

      const currentDice = this._getDicePool()
      const { target, key: targetKey } = event.currentTarget.dataset
      const dataTargetValue = foundry.utils.getProperty(currentDice, `${target}.value`) || {}

      await game.user.setFlag('cortexprime', 'dicePool', null)

      foundry.utils.setProperty(currentDice, `${target}.value`, objectReindexFilter(dataTargetValue, (_, index) => parseInt(index, 10) !== parseInt(targetKey, 10)))

      await game.user.setFlag('cortexprime', 'dicePool', currentDice)

      await this._renderPreservingScroll()
    }
  }

  async _onNewDie (event, actionTarget = event.currentTarget) {
    event.preventDefault()
    const currentDice = this._getDicePool()
    const { target } = actionTarget.dataset
    const dataTargetValue = foundry.utils.getProperty(currentDice, `${target}.value`) || {}
    const currentLength = getLength(dataTargetValue)
    const lastValue = dataTargetValue[currentLength - 1] || '8'

    foundry.utils.setProperty(currentDice, `${target}.value`, { ...dataTargetValue, [currentLength]: lastValue })

    await game.user.setFlag('cortexprime', 'dicePool', null)

    await game.user.setFlag('cortexprime', 'dicePool', currentDice)

    await this._renderPreservingScroll()
  }

  async _removePoolTrait (event, actionTarget = event.currentTarget) {
    event.preventDefault()
    const { source, key } = actionTarget.dataset
    const currentDicePool = this._getDicePool()

    if (getLength(currentDicePool.pool[source] || {}) < 2) {
      delete currentDicePool.pool[source]
    } else {
      delete currentDicePool.pool[source][key]
      currentDicePool.pool[source] = objectReindexFilter(currentDicePool.pool[source], (_, index) => parseInt(index, 10) !== parseInt(key, 10))
    }

    await game.user.setFlag('cortexprime', 'dicePool', null)
    await game.user.setFlag('cortexprime', 'dicePool', currentDicePool)

    await this._renderPreservingScroll()
  }

  async _resetCustomPoolTrait (event) {
    event.preventDefault()

    const currentDice = this._getDicePool()

    foundry.utils.setProperty(currentDice, 'customAdd', {
      label: '',
      value: { 0: '8' }
    })

    await game.user.setFlag('cortexprime', 'dicePool', null)

    await game.user.setFlag('cortexprime', 'dicePool', currentDice)

    await this._renderPreservingScroll()
  }

  async _setPool (pool) {
    const currentDice = this._getDicePool()

    foundry.utils.setProperty(currentDice, 'pool', pool)

    await game.user.setFlag('cortexprime', 'dicePool', null)

    await game.user.setFlag('cortexprime', 'dicePool', currentDice)

    await this._renderPreservingScroll()
  }

  async _rollDicePool (event, actionTarget = event.currentTarget) {
    event.preventDefault()
    const { rollType = 'select' } = actionTarget.dataset

    const dicePool = this._getDicePool().pool
    return completeDicePoolRoll(
      () => rollDice.call(this, dicePool, rollType),
      () => this.close()
    )
  }

  async close (options = {}) {
    await this._resetDicePool({ rerender: false })
    return super.close(options)
  }

  async toggle () {
    if (!this.rendered) {
      await this.render({ force: true })
    } else {
      await this.close()
    }
  }
}
