import { objectReduce } from '../../lib/helpers.js'
import { localizer } from './foundryHelpers.js'

const getAppendDiceContent = (data) => foundry.applications.handlebars.renderTemplate('systems/cortexprime/templates/partials/die-display.html', data)

const getRollFormula = (pool) => {
  return objectReduce(pool, (formula, traitGroup) => {
    const innerFormula = objectReduce(traitGroup || {}, (acc, trait) => [...acc, ...Object.values(trait.value || {})], [])
      .reduce((acc, value) => `${acc}+d${value}`, '')

    return formula ? `${formula}+${innerFormula}` : innerFormula
  }, '')
}

const getRollResults = async pool => {
  const rollFormula = getRollFormula(pool)

  const r = new Roll(rollFormula)

  const roll = await r.evaluate()

  if (game.dice3d) {
    game.dice3d.showForRoll(r, game.user, true)
  }

  const rollResults = roll.dice
    .map(die => ({ faces: die.faces, result: die.results[0].result }))
    .reduce((acc, result) => {
      if (result.result > 1) {
        return { ...acc, results: [...acc.results, result] }
      }

      return { ...acc, hitches: [...acc.hitches, result] }
    }, { hitches: [], results: [] })

  rollResults.hitches.sort((a, b) => {
    return b.faces - a.faces
  })

  rollResults.results.sort((a, b) => {
    if (a.result !== b.result) {
      return b.result - a.result
    }

    return b.faces - a.faces
  })

  return rollResults
}

const markResultTotals = results => {
  results.sort((a, b) => {
    if (a.result !== b.result) {
      return b.result - a.result
    }

    return a.faces - b.faces
  })

  return results.reduce((acc, result) => {
    if (!result.effect && acc.count < 2) return { dice: [...acc.dice, { ...result, total: true }], count: acc.count + 1 }

    return { dice: [...acc.dice, result], count: acc.count }
  }, { dice: [], count: 0 }).dice
}

const markResultEffect = results => {
  results.sort((a, b) => {
    if (a.faces !== b.faces) {
      return b.faces - a.faces
    }

    return a.result - b.result
  })

  return results.reduce((acc, result) => {
    const hasEffectDie = acc.some(item => item.effect)
    if (!result.total && !hasEffectDie) return [...acc, { ...result, effect: true }]

    return [...acc, result]
  }, [])
}

const getDiceByEffect = results => {
  const effectMarkedResults = results.length > 2 ? markResultEffect(results) : results
  const finalResults = markResultTotals(effectMarkedResults)

  finalResults.sort((a, b) => {
    if (a.result !== b.result) {
      return b.result - a.result
    }

    return b.faces - a.faces
  })

  const total = finalResults.reduce((totalValue, result) => result.total ? totalValue + result.result : totalValue, 0)
  const targetEffectDie = finalResults.find(result => result.effect)
  const effectDice = targetEffectDie?.faces ? [targetEffectDie.faces] : []

  return { dice: finalResults, total, effectDice }
}

const getDiceByTotal = results => {
  const totalMarkedResults = markResultTotals(results)
  const finalResults = markResultEffect(totalMarkedResults)

  finalResults.sort((a, b) => {
    if (a.result !== b.result) {
      return b.result - a.result
    }

    return b.faces - a.faces
  })

  const total = finalResults.reduce((totalValue, result) => result.total ? totalValue + result.result : totalValue, 0)
  const targetEffectDie = finalResults.find(result => result.effect)
  const effectDice = targetEffectDie?.faces ? [targetEffectDie.faces] : []

  return { dice: finalResults, total, effectDice }
}

const updateDice = async (element, dice) => {
  const diceElements = element.querySelectorAll('.dice-box .result-die')

  diceElements.forEach((die, index) => {
    const targetDie = dice.dice[index]
    const dieCpt = die.querySelector('.die-cpt')
    die.classList.remove('chosen', 'result', 'effect', 'selected', 'selectable')
    dieCpt.classList.remove('chosen-cpt', 'unchosen-cpt', 'effect-cpt', 'selected-cpt')

    if (targetDie.total) {
      die.classList.add('chosen')
      dieCpt.classList.add('chosen-cpt')
    } else if (targetDie.effect) {
      die.classList.add('effect')
      dieCpt.classList.add('effect-cpt')
    } else {
      die.classList.add('result', 'selectable')
      dieCpt.classList.add('unchosen-cpt')
    }
  })

  const effectDiceContainer = element.querySelector('.effect-dice')
  const totalValue = element.querySelector('.total-value')
  totalValue.textContent = dice.total

  effectDiceContainer.querySelectorAll('.die-icon-wrapper').forEach(die => die.remove())
  const faces = dice.effectDice.length === 0 ? 4 : dice.effectDice[0]
  const index = dice.dice.findIndex(x => x.effect)

  const dieContent = await getAppendDiceContent({ default: dice.effectDice.length === 0, dieRating: faces, key: index, value: faces })
  effectDiceContainer.insertAdjacentHTML('beforeend', dieContent)
}

const dicePicker = async rollResults => {
  const themes = game.settings.get('cortexprime', 'themes')
  const theme = themes.current === 'custom' ? themes.custom : themes.list[themes.current]
  const contentHtml = await foundry.applications.handlebars.renderTemplate('systems/cortexprime/templates/dialog/dice-picker.html', {
    rollResults,
    theme
  })
    const content = document.createElement('div')
    content.insertAdjacentHTML('beforeend', contentHtml)
    const unselectedDice = {
    dice: rollResults.results.map(({ faces, result }) => ({ effect: false, faces, result, total: false })),
    total: null,
    effectDice: []
  }

  const getSelectedDice = (element, includeSelections = true) => {
    const values = { dice: [], total: null, effectDice: [] }

    for (const die of element.querySelectorAll('.dice-box .result-die')) {
      const faces = Number(die.dataset.faces)
      const result = Number.parseInt(die.dataset.result, 10)
      const value = { effect: false, faces, result, total: false }

      if (includeSelections && die.classList.contains('chosen')) {
        values.total = values.total ? values.total + result : result
        value.total = true
      } else if (includeSelections && die.classList.contains('effect')) {
        values.effectDice.push(faces)
        value.effect = true
      }

      values.dice.push(value)
    }

    return values
  }

  return foundry.applications.api.DialogV2.wait({
    window: {
      title: 'Select Your Dice'
    },
    classes: ['dialog', 'dice-picker', 'cortexprime'],
    content,
    buttons: [
      {
        action: 'confirm',
        class: 'dialog-button confirm',
        default: true,
        icon: 'fa-solid fa-check',
        label: localizer('Confirm'),
        callback (event, button, dialog) {
          return getSelectedDice(dialog.element)
        }
      }
    ],
    close () {
      return unselectedDice
    },
    render (event, dialog) {
      const element = dialog.element
      const diceBox = element.querySelector('.dice-box')
      const addToTotal = element.querySelector('.add-to-total')
      const addToEffect = element.querySelector('.add-to-effect')
      const resetSelection = element.querySelector('.reset-selection')
      const effectDiceContainer = element.querySelector('.effect-dice')

        const setSelectionOptionsDisableTo = (value) => {
          addToTotal.disabled = value ?? !addToTotal.disabled
          addToEffect.disabled = value ?? !addToEffect.disabled
        }

        const setSelectionDisable = () => {
          const selectedDice = diceBox.querySelectorAll('.selected')
          const usedDice = diceBox.querySelectorAll('.effect, .chosen')

          setSelectionOptionsDisableTo(!(selectedDice.length > 0))
          resetSelection.disabled = !(selectedDice.length > 0 || usedDice.length > 0)
        }

        const setEffectDice = async (values, defaultValue = false) => {
          const effectDiceHtml = await Promise.all(values
            .map(async value => await getAppendDiceContent({ defaultValue, dieRating: value, value, type: 'effect' })))

          effectDiceContainer.innerHTML = effectDiceHtml.join()
        }

        const setTotalValue = (value) => {
          element.querySelector('.total-value').textContent = value
        }

        diceBox.addEventListener('click', async clickEvent => {
          const target = clickEvent.target.closest('.result-die')
          if (!target || !diceBox.contains(target)) return

          const dieCpt = target.querySelector('.die-cpt')

          if (target.classList.contains('selectable')) {
            target.classList.toggle('selected')
            target.classList.toggle('result')
            dieCpt.classList.toggle('selected-cpt')
            dieCpt.classList.toggle('unchosen-cpt')
          } else if (target.classList.contains('effect')) {
            target.classList.toggle('result')
            target.classList.toggle('effect')
            target.classList.toggle('selectable')
            dieCpt.classList.toggle('unchosen-cpt')
            dieCpt.classList.toggle('effect-cpt')

            effectDiceContainer.querySelector(`[data-key="${target.dataset.key}"]`)?.remove()

            if (!effectDiceContainer.querySelector('.die-icon-wrapper')) {
              const dieContent = await getAppendDiceContent({ defaultValue: true, dieRating: '4', value: '4', type: 'effect' })
              effectDiceContainer.insertAdjacentHTML('beforeend', dieContent)
            }
          } else if (target.classList.contains('chosen')) {
            target.classList.toggle('chosen')
            target.classList.toggle('result')
            target.classList.toggle('selectable')
            dieCpt.classList.toggle('chosen-cpt')
            dieCpt.classList.toggle('unchosen-cpt')

            const totalValue = element.querySelector('.total-value')
            totalValue.textContent = Number.parseInt(totalValue.textContent, 10) - Number.parseInt(target.dataset.result, 10)
          }

          setSelectionDisable()
        })

        effectDiceContainer.addEventListener('mouseup', async mouseEvent => {
          if (mouseEvent.button !== 2) return

          const dieWrapper = mouseEvent.target.closest('.die-icon-wrapper')
          if (!dieWrapper || !effectDiceContainer.contains(dieWrapper)) return

          const resultDie = diceBox.querySelector(`.result-die[data-key="${dieWrapper.dataset.key}"]`)
          resultDie?.classList.toggle('effect')
          resultDie?.classList.toggle('result')
          resultDie?.classList.toggle('selectable')
          resultDie?.querySelector('.die-cpt')?.classList.toggle('effect-cpt')
          resultDie?.querySelector('.die-cpt')?.classList.toggle('unchosen-cpt')

          dieWrapper.remove()

          if (!effectDiceContainer.querySelector('.die-icon-wrapper')) {
            const dieContent = await getAppendDiceContent({ dieRating: '4', value: '4', type: 'effect' })
            effectDiceContainer.insertAdjacentHTML('beforeend', dieContent)
          }

          setSelectionDisable()
        })

        addToEffect.addEventListener('click', async () => {
          const diceForEffect = [...element.querySelectorAll('.result-die.selected')]

          if (diceForEffect.length > 0) {
            effectDiceContainer.querySelector('.default')?.remove()

            for (const die of diceForEffect) {
              const dieCpt = die.querySelector('.die-cpt')
              die.classList.toggle('selected')
              die.classList.toggle('effect')
              die.classList.toggle('selectable')
              dieCpt.classList.toggle('selected-cpt')
              dieCpt.classList.toggle('effect-cpt')
            }

            const effectDiceHtml = await Promise.all(diceForEffect.map(async die => {
              const faces = Number(die.dataset.faces)
              return getAppendDiceContent({ key: die.dataset.key, dieRating: faces, value: faces, type: 'effect' })
            }))
            effectDiceContainer.insertAdjacentHTML('beforeend', effectDiceHtml.join(''))

            setSelectionDisable()
          }
        })

        addToTotal.addEventListener('click', () => {
          const diceForTotal = element.querySelectorAll('.result-die.selected')

          for (const die of diceForTotal) {
            die.classList.toggle('chosen')
            die.classList.toggle('selected')
            die.classList.toggle('selectable')
            const dieCpt = die.querySelector('.die-cpt')
            dieCpt.classList.toggle('chosen-cpt')
            dieCpt.classList.toggle('selected-cpt')

            const totalValue = element.querySelector('.total-value')
            totalValue.textContent = Number.parseInt(die.dataset.result, 10) + Number.parseInt(totalValue.textContent, 10)
          }

          setSelectionDisable()
        })

        element.querySelector('.select-by-effect').addEventListener('click', async () => {
          const dice = getDiceByEffect(rollResults.results)
          await updateDice(element, dice)
          setSelectionDisable()
        })

        element.querySelector('.select-by-total').addEventListener('click', async () => {
          const dice = getDiceByTotal(rollResults.results)
          await updateDice(element, dice)
          setSelectionDisable()
        })

        resetSelection.addEventListener('click', async () => {
          for (const target of diceBox.querySelectorAll('.selected, .effect, .chosen')) {
            target.classList.remove('chosen', 'effect', 'selected')
            target.classList.add('result', 'selectable')

            target.querySelector('.die-cpt').classList.remove('chosen-cpt', 'effect-cpt', 'selected-cpt')
            target.querySelector('.die-cpt').classList.add('unchosen-cpt')
          }

          setTotalValue(0)
          await setEffectDice([4], true)

          setSelectionOptionsDisableTo(true)
          resetSelection.disabled = true
        })

    }
  })
}

export default async function (pool, rollType) {
  const rollResults = await getRollResults(pool)
  const themes = game.settings.get('cortexprime', 'themes')
  const theme = themes.current === 'custom' ? themes.custom : themes.list[themes.current]
  const sourceDefaultCollapsed = game.settings.get('cortexprime', 'rollResultSourceCollapsed')

  await this?._clearDicePool()

  const selectedDice = rollType === 'total'
    ? getDiceByTotal(rollResults.results)
    : rollType === 'effect'
      ? getDiceByEffect(rollResults.results)
      : await dicePicker(rollResults)

  const content = await foundry.applications.handlebars.renderTemplate('systems/cortexprime/templates/chat/roll-result.html', {
    dicePool: pool,
    effectDice: selectedDice.effectDice,
    rollResults: { hitches: rollResults.hitches, results: selectedDice.dice },
    speaker: game.user,
    sourceDefaultCollapsed,
    theme,
    total: selectedDice.total
  })

  await ChatMessage.create({ content })
}
