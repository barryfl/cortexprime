/**
 * Extend the ApplicationV2 ActorSheet with some very simple modifications
 * @extends {foundry.applications.sheets.ActorSheetV2}
 */
import { getLength, objectMapValues, objectReindexFilter, objectFindValue, objectSome } from '../../lib/helpers.js'
import { CortexPrimeHelp } from '../apps/CortexPrimeHelp.js'
import { localizer } from '../scripts/foundryHelpers.js'
import {
  removeItems,
  toggleItems
} from '../scripts/sheetHelpers.js'

const { HandlebarsApplicationMixin } = foundry.applications.api
const { ActorSheetV2 } = foundry.applications.sheets

export class CortexPrimeActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  _savePromise = Promise.resolve()

  get actor () {
    return super.actor
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    tag: 'form',
    classes: ['cortexprime', 'sheet', 'actor', 'actor-sheet'],
    actions: {
      actorTypeConfirm: function (event, target) { return this._actorTypeConfirm(event, target) },
      addAsset: function (event, target) { return this._addAsset(event, target) },
      addComplication: function (event, target) { return this._addComplication(event, target) },
      addDescriptor: function (event, target) { return this._addDescriptor(event, target) },
      addNote: function (event, target) { return this._addNote(event, target) },
      addPp: function () { return this._addPp() },
      addSfx: function (event, target) { return this._addSfx(event, target) },
      addSubTrait: function (event, target) { return this._addSubTrait(event, target) },
      addToPool: function (event, target) { return this._addToPool(event, target) },
      addTrait: function (event, target) { return this._addTrait(event, target) },
      closeTraitSetEdit: function (event) { return this._closeTraitSetEdit(event) },
      newDie: function (event, target) { return this._newDie(event, target) },
      removeItem: function (event, target) { return removeItems.call(this, event, target) },
      spendPp: function () { return this._spendPp() },
      toggleItem: function (event, target) { return toggleItems.call(this, event, target) },
      traitSetEdit: function (event, target) { return this._traitSetEdit(event, target) },
      updateActorSettings: function (event) { return this._updateActorSettings(event) },
      editProfileImage: function (event, target) {return this._editProfileImage(event, target)},
      openHelp: function () {new CortexPrimeHelp('systems/cortexprime/templates/help/index.html').render(true)}
    },
    form: {
      closeOnSubmit: false,
      submitOnChange: true,
      handler: function (event, form, formData) { return this._saveForm(event, form, formData) }
    },
    position: {
      width: 960,
      height: 900
    }
  }

  static PARTS = {
    sheet: {
      template: 'systems/cortexprime/templates/actor/actor-sheet.html'
    }
  }

  static TABS = {
    primary: {
      tabs: [
        { id: 'traits' },
        { id: 'notes' }
      ],
      initial: 'traits'
    }
  }

  async _prepareContext (options) {
    const context = await super._prepareContext(options)
    const themes = game.settings.get('cortexprime', 'themes')
    const theme = themes.current === 'custom' ? themes.custom : themes.list[themes.current]

    return {
      ...context,
      actor: this.actor,
      data: this.actor.toObject(false),
      owner: this.actor.isOwner,
      cssClass: this.isEditable ? 'editable' : 'locked',
      actorTypeOptions: objectMapValues(game.settings.get('cortexprime', 'actorTypes'), val => val.name),
      theme,
    }
  }

  async _saveForm (event, form, submittedFormData) {
    if (!form || event?.target?.classList?.contains('die-select') || event?.target?.classList?.contains('pp-number-field')) return

    const updateData = foundry.utils.deepClone(submittedFormData.object)

    this._savePromise = this._savePromise.then(() => this.actor.update(updateData))
    return this._savePromise
  }

  async _saveCurrentForm () {
    if (this.form) await this.submit()
    await this._savePromise
  }

  /** @override */
  async _onRender (context, options) {
    await super._onRender(context, options)

    for (const tab of this.element.querySelectorAll('.sheet-tabs [data-tab]')) {
      tab.addEventListener('click', async event => {
        event.preventDefault()
        const tabElement = event.currentTarget
        await this._saveCurrentForm()
        const { tab: tabId, group } = tabElement.dataset
        this.changeTab(tabId, group)
      })
    }  

    for (const select of this.element.querySelectorAll('.die-select')) {
      select.addEventListener('change', event => this._onDieChange(event))
      select.addEventListener('mouseup', event => this._onDieRemove(event))
    }

    for (const field of this.element.querySelectorAll('.pp-number-field')) {
      field.addEventListener('change', event => this._ppNumberChange(event))
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */

  async _actorTypeConfirm (event) {
    event.preventDefault()
    await this._saveCurrentForm()
    const actorTypes = game.settings.get('cortexprime', 'actorTypes')
    const actorTypeIndex = this.element.querySelector('.actor-type-select')?.value

    const actorType = actorTypes[actorTypeIndex]

    if (!actorType) return

    await this.actor.update({
      'img': actorType.defaultImage,
      'system.actorType': actorType,
      'system.pp.value': actorType.hasPlotPoints ? 1 : 0
    })
  }

  async _addAsset (event, target = event.currentTarget) {
    event.preventDefault()
    await this._saveCurrentForm()
    const { path } = target.dataset
    const currentAssets = foundry.utils.getProperty(this.actor, `${path}.assets`) ?? {}

    console.log(path, currentAssets)

    await this._resetDataPoint(path, 'assets', {
      ...currentAssets,
      [getLength(currentAssets)]: {
        label: localizer('NewAsset'),
        dice: {
          value: {
            0: '6'
          }
        }
      }
    })
  }

  async _addComplication(event, target = event.currentTarget) {
    event.preventDefault()
    await this._saveCurrentForm()
    const { path } = target.dataset
    const currentComplications = foundry.utils.getProperty(this.actor, `${path}.complications`) ?? {}

    await this._resetDataPoint(path, 'complications', {
      ...currentComplications,
      [getLength(currentComplications)]: {
        label: localizer('NewComplication'),
        dice: {
          value: {
            0: '6'
          }
        }
      }
    })
  }

  async _addDescriptor(event, target = event.currentTarget) {
    event.preventDefault()
    await this._saveCurrentForm()
    const { path } = target.dataset
    const currentDescriptors = foundry.utils.getProperty(this.actor, `${path}.descriptors`) ?? {}

    await this._resetDataPoint(path, 'descriptors', {
      ...currentDescriptors,
      [getLength(currentDescriptors)]: {
        label: localizer('NewDescriptor'),
        value: null
      }
    })
  }

  async _addNote(event) {
    event.preventDefault()
    await this._saveCurrentForm()
    const currentNotes = this.actor.system.actorType.notes ?? {}

    await this._resetDataPoint('system.actorType', 'notes', {
      ...currentNotes,
      [getLength(currentNotes)]: {
        label: localizer('Notes'),
        value: ''
      }
    })
  }

  async _addSfx (event, target = event.currentTarget) {
    event.preventDefault()
    await this._saveCurrentForm()
    const { path } = target.dataset
    const currentSfx = foundry.utils.getProperty(this.actor, `${path}.sfx`) ?? {}

    await this._resetDataPoint(path, 'sfx', {
      ...currentSfx,
      [getLength(currentSfx)]: {
        description: null,
        label: localizer('NewSfx'),
        unlocked: true
      }
    })
  }

  async _addSubTrait(event, target = event.currentTarget) {
    event.preventDefault()
    await this._saveCurrentForm()
    const { path } = target.dataset
    const currentSubTraits = foundry.utils.getProperty(this.actor, `${path}.subTraits`) ?? {}

    await this._resetDataPoint(path, 'subTraits', {
      ...currentSubTraits,
      [getLength(currentSubTraits)]: {
        dice: {
          value: {
            0: '8'
          }
        },
        label: localizer('NewSubTrait')
      }
    })
  }

  async _addToPool (event, target = event.currentTarget) {
    await this._saveCurrentForm()
    const { consumable, path, label } = target.dataset
    let value = foundry.utils.getProperty(this.actor, `${path}.value`)

    if (consumable) {
      const selectedDice = await this._getConsumableDiceSelection(value, label)

      if (selectedDice.remove?.length) {
        const newValue = objectReindexFilter(value, (_, key) => !selectedDice.remove.map(x => parseInt(x, 10)).includes(parseInt(key, 10)))

        await this._resetDataPoint(path, 'value', newValue)
      }

      value = selectedDice.value
    }

    if (getLength(value)) {
      await game.cortexprime.UserDicePool._addTraitToPool(this.actor.name, label, value)
    }
  }

  async _addTrait (event, target = event.currentTarget) {
    await this._saveCurrentForm()
    const { path } = target.dataset
    const currentCustomTraits = foundry.utils.getProperty(this.actor, `${path}.customTraits`) ?? {}

    await this._resetDataPoint(path, 'customTraits', {
      ...currentCustomTraits,
      [getLength(currentCustomTraits)]: {
        id: `_${Date.now()}`,
        name: localizer('NewTrait'),
        dice: {
          value: {
            0: '8'
          }
        }
      }
    })
  }

  async _closeTraitSetEdit(event) {
    await this._saveCurrentForm()
    await this.actor.update({
      ['system.actorType.traitSetEdit']: null
    })
  }

async _getConsumableDiceSelection (options, label) {
  const content = await foundry.applications.handlebars.renderTemplate(
    'systems/cortexprime/templates/dialog/consumable-dice.html',
    {
      options,
      isOwner: game.user.isOwner
    }
  )

return foundry.applications.api.DialogV2.wait({
  window: {
    title: label
  },

  classes: ['dialog', 'dice-picker', 'cortexprime'],

  content,

    buttons: [
      {
        action: 'cancel',
        icon: 'fa-solid fa-times',
        label: localizer('Cancel'),
        default: true,
        callback: () => ({
          remove: [],
          value: {}
        })
      },
      {
        action: 'done',
        icon: 'fa-solid fa-check',
        label: localizer('AddToPool'),
        callback: (event, button, dialog) => {
          const root = dialog.element

          const remove =
            root.querySelector('.remove-check')?.checked ?? false

          const selectedDice =
            [...root.querySelectorAll('.die-select.selected')]

          if (!selectedDice.length) {
            return {
              remove: [],
              value: {}
            }
          }

          return selectedDice.reduce(
            (selectedValues, selectedDie, index) => {
              if (remove) {
                selectedValues.remove.push(selectedDie.dataset.key)
              }

              selectedValues.value[index] =
                selectedDie.dataset.value

              return selectedValues
            },
            {
              remove: [],
              value: {}
            }
          )
        }
      }
    ],

    render: (event, dialog) => {
      dialog.element
        .querySelectorAll('.die-select')
        .forEach(dieContainer => {
          dieContainer.addEventListener('click', () => {
            const die = dieContainer.querySelector('.die-cpt')

            dieContainer.classList.toggle('result')
            dieContainer.classList.toggle('selected')

            die?.classList.toggle('unchosen-cpt')
            die?.classList.toggle('chosen-cpt')
          })
        })
    },

    close: () => ({
      remove: [],
      value: {}
    })
  })
}

  async _newDie (event, actionTarget = event.currentTarget) {
    event.preventDefault()
    await this._saveCurrentForm()
    const { target } = actionTarget.dataset
    const currentDiceData = foundry.utils.getProperty(this.actor, target)
    const currentDice = currentDiceData?.value ?? {}
    const newIndex = getLength(currentDice)
    const newValue = currentDice[newIndex - 1] ?? '8'

    await this.actor.update({
      [target]: {
        value: {
          ...currentDice,
          [newIndex]: newValue
        }
      }
    })
  }

  async _onDieChange (event) {
    event.preventDefault()
    const dieSelect = event.currentTarget
    await this._saveCurrentForm()
    const { target, key: targetKey } = dieSelect.dataset
    const targetValue = dieSelect.value
    const currentDiceData = foundry.utils.getProperty(this.actor, target)

    console.log(target)

    const newValue = objectMapValues(currentDiceData.value ?? {}, (value, index) => parseInt(index, 10) === parseInt(targetKey, 10) ? targetValue : value)

    await this._resetDataPoint(target, 'value', newValue)
  }

  async _onDieRemove (event) {
    event.preventDefault()

    if (event.button === 2) {
      const dieSelect = event.currentTarget
      await this._saveCurrentForm()
      const { target, key: targetKey } = dieSelect.dataset
      const currentDiceData = foundry.utils.getProperty(this.actor, target)

      const newValue = objectReindexFilter(currentDiceData.value ?? {}, (_, key) => parseInt(key, 10) !== parseInt(targetKey))

      await this._resetDataPoint(target, 'value', newValue)
    }
  }

  async _ppNumberChange (event) {
    event.preventDefault()
    const ppField = event.currentTarget
    await this._saveCurrentForm()
    const parsedValue = parseInt(ppField.value, 10)
    const currentValue = parseInt(this.actor.pp.value, 10)
    const newValue = parsedValue < 0 ? 0 : parsedValue
    const changeAmount = newValue - currentValue

    await this.actor.changePpBy(changeAmount, true)
  }

  async _addPp () {
    await this._saveCurrentForm()
    await this.actor.changePpBy(1)
  }

  async _spendPp () {
    await this._saveCurrentForm()
    await this.actor.changePpBy(-1)

    if (game.dice3d) {
      game.dice3d.show({ throws: [{ dice: [{ result: 1, resultLabel: 1, type: 'dp', vectors: [], options: {} }] }] }, game.user, true)
    }
  }

  async _resetDataPoint(path, target, value) {
    await this.actor.update({
      [`${path}.${target}`]: foundry.data.operators.ForcedDeletion.create()
    })

    await this.actor.update({
      [`${path}.${target}`]: value
    })
  }

  async _traitSetEdit(event, target = event.currentTarget) {
    await this._saveCurrentForm()
    const { traitSet } = target.dataset

    await this.actor.update({
      ['system.actorType.traitSetEdit']: traitSet
    })
  }

  async _updateActorSettings(event) {
    event.preventDefault()
    await this._saveCurrentForm()

    const actorData = this.actor.system.actorType
    const actorTypeSettings = objectFindValue(game.settings.get('cortexprime', 'actorTypes'), actorType => actorType.id === actorData.id)

    if (!actorTypeSettings) {
      ui.notifications.error(localizer('MissingActorTypeMessage'))
      return
    }

    const newData = {
      ...actorData,
      ...objectMapValues(actorTypeSettings, (propValue, key) => {
        if (key === 'simpleTraits') {
          return objectMapValues(propValue, ({ dice, hasDescription, id, label, settings }) => {
            const matchingSetting = objectFindValue((actorData.simpleTraits ?? {}), ({ id: matchId }) => matchId === id) ?? {}

            return {
              ...matchingSetting,
              dice: {
                ...matchingSetting.dice,
                consumable: dice.consumable
              },
              hasDescription,
              id,
              label,
              settings
            }
          })
        }

        if (key === 'traitSets') {
          return objectMapValues(propValue, ({ hasDescription, id, label, settings, traits }) => {
            const matchingSetting = objectFindValue((actorData.traitSets ?? {}), ({ id: matchId }) => matchId === id) ?? {}

            return {
              ...matchingSetting,
              description: matchingSetting.description,
              hasDescription,
              id,
              label,
              shutdown: matchingSetting.shutdown,
              settings,
              traits: objectMapValues(traits ?? {}, trait => {
                const matchingTraitSetting = objectFindValue(matchingSetting.traits ?? {}, ({ id: matchId }) => matchId === trait.id) ?? {}
                return {
                  ...matchingTraitSetting,
                  id: trait.id,
                  name: trait.name
                }
              })
            }
          })
        }

        return propValue
      })
    }

    this._resetDataPoint('system', 'actorType', newData)
    this.actor.update()
  }

  async close (options = {}) {
    await this._saveCurrentForm()
    return super.close(options)
  }
  async _editProfileImage (event) {
  event.preventDefault()

  const picker = new foundry.applications.apps.FilePicker({
    type: 'image',
    current: this.actor.img,
    callback: async imagePath => {
      await this.actor.update({ img: imagePath })
    }
  })

  await picker.render(true)
}
}
