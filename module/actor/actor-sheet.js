/**
 * Extend the ApplicationV2 ActorSheet with some very simple modifications
 * @extends {foundry.applications.sheets.ActorSheetV2}
 */
import { getLength, objectMapValues, objectReindexFilter, objectFindValue, objectSome } from '../../lib/helpers.js'
import { CortexPrimeHelp } from '../apps/CortexPrimeHelp.js'
import { normalizeActorType } from './normalizeActorType.js'
import { syncActorWithActorType } from './syncActorType.js'
import { appendCustomTrait, canCreateCustomTrait, isCustomTraitSetPath } from './customTraits.js'
import { findSuppressibleTrait, prepareTraitSuppressions, withTraitRestored, withTraitSuppressed } from './traitSuppression.js'
import { changeResourceValue, initializeActorTypeResources, isResourceTraitPath, pruneImplicitResourceSettings } from './resourceTraits.js'
import { ScrollPreservation } from '../applications/scrollPreservation.js'
import { filterRenderableSections, isPredefinedSectionAvailable, PREDEFINED_ACTOR_SHEET_SECTIONS, shouldRenderSection } from './actorTypeSections.js'
import { localizer } from '../scripts/foundryHelpers.js'
import {
  removeItems,
  toggleItems
} from '../scripts/sheetHelpers.js'

const { HandlebarsApplicationMixin } = foundry.applications.api
const { ActorSheetV2 } = foundry.applications.sheets
const actorSheetSectionWidths = ['full', 'half', 'third']

export class CortexPrimeActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  _savePromise = Promise.resolve()
  _sheetScrollPreservation = new ScrollPreservation('.sheet-body')

  get actor () {
    return super.actor
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    tag: 'form',
    classes: ['cortexprime', 'sheet', 'actor', 'actor-sheet'],
    window: {
        resizable: true
    },
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
      changeResource: function (event, target) { return this._changeResource(event, target) },
      newDie: function (event, target) { return this._newDie(event, target) },
      removeItem: function (event, target) { return removeItems.call(this, event, target) },
      restoreTrait: function (event, target) { return this._restoreTrait(event, target) },
      spendPp: function () { return this._spendPp() },
      suppressTrait: function (event, target) { return this._suppressTrait(event, target) },
      toggleItem: function (event, target) { return toggleItems.call(this, event, target) },
      traitSetEdit: function (event, target) { return this._traitSetEdit(event, target) },
      updateActorSettings: function (event) { return this._updateActorSettings(event) },
      editProfileImage: function (event, target) {return this._editProfileImage(event, target)},
      openHelp: function () {new CortexPrimeHelp('systems/cortexprime/templates/help/index.html').render(true)},
      resourceImagePicker: function (event, target) { return this._resourceImagePicker(event, target) }
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

  async _prepareContext (options) {
    const context = await super._prepareContext(options)
    const themes = game.settings.get('cortexprime', 'themes')
    const theme = themes.current === 'custom' ? themes.custom : themes.list[themes.current]
    const actorType = prepareTraitSuppressions(normalizeActorType(this.actor.system.actorType, {
      legacyLabel: localizer('SimpleTraits')
    }))
    for (const traitSet of Object.values(actorType?.traitSets ?? {})) {
      traitSet._canCreateCustomTraits = canCreateCustomTrait(traitSet, {
        isEditable: this.isEditable,
        isGM: game.user.isGM,
        isOwner: this.actor.isOwner
      })
    }
    const configuredTabs = actorType?.tabs && getLength(actorType.tabs)
      ? Object.values(actorType.tabs)
      : [{ id: 'traits', label: localizer('Traits') }]
    const configuredTabIds = configuredTabs.map(tab => tab.id)
    const configuredSheetTabIds = configuredTabs.map(tab => `trait-${tab.id}`)
    const defaultTabId = configuredTabIds[0]
    const traitSets = Object.entries(actorType?.traitSets ?? {})
    const availablePredefinedSections = PREDEFINED_ACTOR_SHEET_SECTIONS.filter(section => isPredefinedSectionAvailable(actorType, section.id))
    const leadingSections = availablePredefinedSections.filter(section => ['profile', 'plotPoints'].includes(section.id))
    const trailingSections = availablePredefinedSections.filter(section => ['assets', 'complications'].includes(section.id))
    const naturalSections = [
      ...leadingSections.map(({ id }, order) => ({ id, order, type: id })),
      ...traitSets.map(([traitSetIndex, traitSet], index) => ({
        id: traitSet.id,
        order: index + leadingSections.length,
        traitSet,
        traitSetIndex,
        traitSets: { [traitSetIndex]: traitSet },
        type: 'traitSet'
      })),
      ...trailingSections.map(({ id }, index) => ({
        id,
        order: traitSets.length + index + leadingSections.length,
        type: id
      }))
    ]
    const sheetSections = naturalSections.map(section => {
      const layout = actorType?.sectionLayout?.[section.id] ?? {}
      const legacyTabId = section.type === 'traitSet' ? section.traitSet.tabId : actorType?.sectionTabs?.[section.id]

      return {
        ...section,
        enabled: shouldRenderSection(actorType, section),
        order: Number.isFinite(Number(layout.order)) ? Number(layout.order) : section.order,
        tabId: configuredTabIds.includes(layout.tabId ?? legacyTabId) ? (layout.tabId ?? legacyTabId) : defaultTabId,
        width: actorSheetSectionWidths.includes(layout.width) ? layout.width : 'full'
      }
    }).sort((a, b) => a.order - b.order)

    if (!configuredSheetTabIds.includes(this._activeSheetTab) && !(this._activeSheetTab === 'notes' && actorType?.hasNotesPage)) {
      this._activeSheetTab = configuredSheetTabIds[0]
    }

    const actorTabs = configuredTabs.map(tab => ({
      ...tab,
      cssClass: this._activeSheetTab === `trait-${tab.id}` ? 'active' : '',
      sections: filterRenderableSections(actorType, sheetSections).filter(section => section.tabId === tab.id),
      sheetTabId: `trait-${tab.id}`,
    }))

    const data = this.actor.toObject(false)
    data.system.actorType = actorType

    return {
      ...context,
      actor: this.actor,
      actorTabs,
      data,
      editable: this.actor.isOwner && this.isEditable,
      notesTabClass: this._activeSheetTab === 'notes' ? 'active' : '',
      owner: this.actor.isOwner,
      cssClass: this.isEditable ? 'editable' : 'locked',
      actorTypeOptions: objectMapValues(game.settings.get('cortexprime', 'actorTypes'), val => val.name),
      theme,
    }
  }

  async _saveForm (event, form, submittedFormData) {
    if (!form || event?.target?.classList?.contains('die-select') || event?.target?.classList?.contains('pp-number-field')) return

    this._preserveSheetScroll()
    const updateData = foundry.utils.deepClone(submittedFormData.object)
    pruneImplicitResourceSettings(updateData, this.actor.toObject(false))

    this._savePromise = this._savePromise.then(() => this.actor.update(updateData))
    return this._savePromise
  }

  async _saveCurrentForm () {
    if (this.form) await this.submit()
    await this._savePromise
    this._preserveSheetScroll()
  }

  _preserveSheetScroll () {
    return this._sheetScrollPreservation.preserve(this.element)
  }

  _restoreSheetScroll () {
    return this._sheetScrollPreservation.restore(this.element)
  }

  _discardPreservedSheetScroll () {
    this._sheetScrollPreservation.clear()
  }


  /** @override */
  async _onRender (context, options) {
    await super._onRender(context, options)

    for (const tab of this.element.querySelectorAll('.sheet-tabs [data-tab]')) {
      tab.addEventListener('click', async event => {
        event.preventDefault()
        const tabElement = event.currentTarget
        await this._saveCurrentForm()
        this._discardPreservedSheetScroll()
        this._activeSheetTab = tabElement.dataset.tab
        await this.render({ force: true })
      })
    }  

    this._restoreSheetScroll()

    for (const select of this.element.querySelectorAll('.die-select')) {
      select.addEventListener('change', event => this._onDieChange(event))
      select.addEventListener('mouseup', event => this._onDieRemove(event))
    }

    for (const field of this.element.querySelectorAll('.pp-number-field')) {
      field.addEventListener('change', event => this._ppNumberChange(event))
    }

    for (const select of this.element.querySelectorAll('.actor-value-type-select, .resource-image-display-select')) {
      select.addEventListener('change', async () => {
        await this._saveCurrentForm()
        this._preserveSheetScroll()
        await this.render({ force: true })
      })
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
    this._discardPreservedSheetScroll()
    const actorTypes = game.settings.get('cortexprime', 'actorTypes')
    const actorTypeIndex = this.element.querySelector('.actor-type-select')?.value

    const actorType = actorTypes[actorTypeIndex]

    if (!actorType) return

    await this.actor.update({
      'img': actorType.defaultImage,
      'system.actorType': initializeActorTypeResources(actorType),
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
    event.preventDefault()
    const { path } = target.dataset
    await this._saveCurrentForm()
    if (!isCustomTraitSetPath(path)) return

    const traitSet = foundry.utils.getProperty(this.actor, path)
    if (!canCreateCustomTrait(traitSet, {
      isEditable: this.isEditable,
      isGM: game.user.isGM,
      isOwner: this.actor.isOwner
    })) {
      ui.notifications.warn(localizer('CustomTraitsNotAllowed'))
      return
    }

    const currentCustomTraits = foundry.utils.getProperty(this.actor, `${path}.customTraits`) ?? {}

    await this._resetDataPoint(path, 'customTraits', appendCustomTrait(currentCustomTraits, {
      id: `_${Date.now()}`,
      name: localizer('NewTrait'),
      valueType: 'die',
      dice: {
        value: {
          0: '8'
        }
      }
    }))
  }

  async _closeTraitSetEdit(event) {
    await this._saveCurrentForm()
    this._discardPreservedSheetScroll()
    await this.actor.update({
      ['system.actorType.traitSetEdit']: null
    })
  }

  async _changeResource (event, target = event.currentTarget) {
    event.preventDefault()
    const { direction, traitPath } = target.dataset
    await this._saveCurrentForm()
    if (!this.isEditable || !this.actor.isOwner || !isResourceTraitPath(traitPath)) return

    const trait = foundry.utils.getProperty(this.actor, traitPath)
    if (trait?.valueType !== 'resource') return

    this._preserveSheetScroll()

    await this.actor.update({
      [`${traitPath}.resource.value`]: changeResourceValue(trait, direction)
    })
  }

  async _resourceImagePicker (event, target = event.currentTarget) {
    event.preventDefault()
    const { path } = target.dataset
    await this._saveCurrentForm()
    this._discardPreservedSheetScroll()
    const traitPath = path?.replace(/\.valueSettings\.image$/, '')
    if (!this.isEditable || !this.actor.isOwner || !isResourceTraitPath(traitPath)) return

    const picker = new foundry.applications.apps.FilePicker({
      type: 'image',
      current: foundry.utils.getProperty(this.actor, path) ?? '',
      callback: async image => {
        this._preserveSheetScroll()
        await this.actor.update({ [path]: image })
        this._preserveSheetScroll()
        await this.render({ force: true })
      }
    })
    await picker.render(true)
  }

async _getConsumableDiceSelection (options, label) {
    const contentHtml = await foundry.applications.handlebars.renderTemplate(
      'systems/cortexprime/templates/dialog/consumable-dice.html',
      {
        options,
        isOwner: game.user.isOwner
      }
    )

const content = document.createElement('div')
content.insertAdjacentHTML('beforeend', contentHtml)

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
    this._preserveSheetScroll()
    await this.actor.update({
      [`${path}.${target}`]: foundry.data.operators.ForcedDeletion.create()
    })

    this._preserveSheetScroll()
    await this.actor.update({
      [`${path}.${target}`]: value
    })
  }

  async _traitSetEdit(event, target = event.currentTarget) {
    await this._saveCurrentForm()
    this._discardPreservedSheetScroll()
    const { traitSet } = target.dataset

    await this.actor.update({
      ['system.actorType.traitSetEdit']: traitSet
    })
  }

  async _suppressTrait (event, target = event.currentTarget) {
    event.preventDefault()
    const { suppressionId, traitName } = target.dataset
    if (!this.isEditable || !this.actor.isOwner || !suppressionId) return false

    const actorType = normalizeActorType(this.actor.system.actorType, {
      legacyLabel: localizer('SimpleTraits')
    })
    if (!findSuppressibleTrait(actorType, suppressionId)) return false

    await this._saveCurrentForm()
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: localizer('HideTrait') },
      content: `<p>${localizer('HideTraitConfirmation')}</p><p><strong>${foundry.utils.escapeHTML(traitName ?? '')}</strong></p>`,
      yes: { default: false }
    })
    if (!confirmed) return false

    const suppressedTraits = withTraitSuppressed(this.actor.system.actorType.suppressedTraits, suppressionId)
    await this._resetDataPoint('system.actorType', 'suppressedTraits', suppressedTraits)
    return true
  }

  async _restoreTrait (event, target = event.currentTarget) {
    event.preventDefault()
    const { suppressionId } = target.dataset
    if (!this.isEditable || !this.actor.isOwner || !suppressionId) return false

    const actorType = normalizeActorType(this.actor.system.actorType, {
      legacyLabel: localizer('SimpleTraits')
    })
    if (!findSuppressibleTrait(actorType, suppressionId)) return false

    await this._saveCurrentForm()
    const suppressedTraits = withTraitRestored(this.actor.system.actorType.suppressedTraits, suppressionId)
    await this._resetDataPoint('system.actorType', 'suppressedTraits', suppressedTraits)
    return true
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

    await syncActorWithActorType(this.actor, actorTypeSettings)
  }

  async close (options = {}) {
    await this._saveCurrentForm()
    this._discardPreservedSheetScroll()
    return super.close(options)
  }
  async _editProfileImage (event) {
  event.preventDefault()

  const picker = new foundry.applications.apps.FilePicker({
    type: 'image',
    current: this.actor.img,
    callback: async imagePath => {
      this._preserveSheetScroll()
      await this.actor.update({ img: imagePath })
    }
  })

  await picker.render(true)
}
}
