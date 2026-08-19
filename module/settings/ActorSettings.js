import { localizer } from '../scripts/foundryHelpers.js'
import { CortexPrimeHelp } from '../apps/CortexPrimeHelp.js'
import { CortexPrimeApplication } from '../applications/CortexPrimeApplication.js'
import { normalizeActorType } from '../actor/normalizeActorType.js'
import { isPredefinedSectionAvailable, isSectionPlacementEnabled, PREDEFINED_ACTOR_SHEET_SECTIONS, updateBreadcrumbName, withSectionPlacementEnabled } from '../actor/actorTypeSections.js'
import { getLength, objectFindKey, objectFindValue, objectMapValues, objectReduce, objectReindexFilter } from '../../lib/helpers.js'
import { removeItem, reorderItem } from '../scripts/settingsHelpers.js'
import { actorsMatchingActorType, syncActorsWithActorType } from '../actor/syncActorType.js'

const actorSheetSections = Object.fromEntries(PREDEFINED_ACTOR_SHEET_SECTIONS.map(({ id, label }) => [id, label]))
const sheetSectionWidths = ['full', 'half', 'third']

export default class ActorSettings extends CortexPrimeApplication {
  _savePromise = Promise.resolve()

  static DEFAULT_OPTIONS = {
    id: 'actor-settings',
    tag: 'form',
    classes: ['cortexprime', 'cortexprime-application', 'actor-settings'],
    form: {
      closeOnSubmit: false,
      submitOnChange: true,
      handler: function (event, form, formData) { return this._saveForm(event, form, formData) }
    },
    position: {
      width: 600,
      height: 900,
      top: 200,
      left: 400
    }
  }

  static PARTS = {
    settings: { template: 'systems/cortexprime/templates/actor/settings.html' }
  }

  get title () {
    return localizer('ActorSettings')
  }

  async _prepareContext (options) {
    const context = await super._prepareContext(options)
    const breadcrumbs = game.settings.get('cortexprime', 'actorBreadcrumbs') ?? {}
    const actorTypes = foundry.utils.deepClone(game.settings.get('cortexprime', 'actorTypes') ?? {})

    for (const [actorTypeIndex, rawActorType] of Object.entries(actorTypes)) {
      const actorType = normalizeActorType(rawActorType, {
        formPath: `actorTypes.${actorTypeIndex}`,
        legacyLabel: localizer('SimpleTraits'),
        sourcePath: actorTypeIndex
      })
      actorTypes[actorTypeIndex] = actorType
      const tabs = actorType.tabs && getLength(actorType.tabs)
        ? actorType.tabs
        : { 0: { id: 'traits', label: localizer('Traits') } }
      const tabIds = Object.values(tabs).map(tab => tab.id)
      const defaultTabId = tabIds[0]
      const traitSets = Object.entries(actorType.traitSets ?? {})
      const availablePredefinedSections = PREDEFINED_ACTOR_SHEET_SECTIONS.filter(section => isPredefinedSectionAvailable(actorType, section.id))
      const leadingSections = availablePredefinedSections.filter(section => ['profile', 'plotPoints'].includes(section.id))
      const trailingSections = availablePredefinedSections.filter(section => ['assets', 'complications'].includes(section.id))
      const naturalSections = [
        ...leadingSections.map(({ id, label }, order) => ({ id, label: localizer(label), layoutId: id, order })),
        ...traitSets.map(([traitSetIndex, traitSet], index) => ({
          id: traitSet.id,
          label: traitSet.label || localizer('TraitSet'),
          layoutId: traitSet._compatibility?.layoutId ?? traitSet.id,
          order: index + leadingSections.length,
          traitSetIndex
        })),
        ...trailingSections.map(({ id, label }, index) => ({
          id,
          label: localizer(label),
          layoutId: id,
          order: traitSets.length + index + leadingSections.length
        }))
      ]

      actorType.tabs = tabs
      actorType.sectionLayout = Object.fromEntries(naturalSections.map(section => {
        const current = actorType.sectionLayout?.[section.id] ?? {}
        const legacyTabId = section.traitSetIndex !== undefined
          ? actorType.traitSets[section.traitSetIndex]?.tabId
          : actorType.sectionTabs?.[section.id]

        return [section.id, {
          enabled: isSectionPlacementEnabled(current),
          order: Number.isFinite(Number(current.order)) ? Number(current.order) : section.order,
          tabId: tabIds.includes(current.tabId ?? legacyTabId) ? (current.tabId ?? legacyTabId) : defaultTabId,
          width: sheetSectionWidths.includes(current.width) ? current.width : 'full'
        }]
      }))
      actorType.sheetSections = naturalSections
        .map(section => ({ ...section, ...actorType.sectionLayout[section.id] }))
        .sort((a, b) => a.order - b.order)
      actorType.traitSets = objectMapValues(actorType.traitSets ?? {}, traitSet => ({
        ...traitSet,
        tabId: tabIds.includes(traitSet.tabId) ? traitSet.tabId : defaultTabId
      }))
    }

    return {
      ...context,
      actorTypes,
      breadcrumbs,
      goBack: breadcrumbs[getLength(breadcrumbs ?? {}) - 2]?.target ?? 0,
      isGM: game.user.isGM
    }
  }

  async _saveForm (event, form, submittedFormData) {
    if (!form || event?.target?.classList?.contains('die-select')) return
    const submittedData = submittedFormData.object
    const actorTypes = foundry.utils.deepClone(
      submittedData.actorTypes ?? foundry.utils.expandObject(submittedData).actorTypes ?? {}
    )

    this._savePromise = this._savePromise.then(async () => {
      const currentActorTypes = game.settings.get('cortexprime', 'actorTypes') ?? {}
      await game.settings.set('cortexprime', 'actorTypes', foundry.utils.mergeObject(currentActorTypes, actorTypes))
    })

    return this._savePromise
  }

  async _saveCurrentForm () {
    if (this.form) await this.submit()
    await this._savePromise
  }

  async _onRender (context, options) {
    await super._onRender(context, options)

    const clickHandlers = {
      '#add-new-actor-type': this._addNewActorType,
      '.add-descriptor': this._addDescriptor,
      '.add-sfx': this._addSfx,
      '.add-sub-trait': this._addSubTrait,
      '.add-tab': this._addTab,
      '.add-trait': this._addTrait,
      '.add-trait-set': this._addTraitSet,
      '.breadcrumb:not(.active), .go-back': this._breadcrumbChange,
      '.default-image': this._changeDefaultImage,
      '.duplicate-item': this._duplicateItem,
      '.new-die': this._newDie,
      '.move-sheet-section': this._moveSheetSection,
      '.remove-actor-tab': this._removeTab,
      '.sync-existing-actors': this._syncExistingActors,
      '.toggle-sheet-section': this._toggleSheetSection,
      '.view-change': this._viewChange,
      '[data-action="openActorSettingsHelp"]': this._openActorSettingsHelp
    }


    for (const [selector, handler] of Object.entries(clickHandlers)) {
      if (typeof handler !== 'function') {
        console.error(`ActorSettings click handler for "${selector}" is not defined.`)
        continue
      }

      this.element.querySelectorAll(selector).forEach(element => {
        element.addEventListener('click', event => handler.call(this, event))
      })
    }
      this.element.addEventListener('change', async event => {
        if (event.target.classList.contains('die-select')) {
          return this._onDieChange(event)
        }

        if (event.target.classList.contains('breadcrumb-name-change') || event.target.classList.contains('rerender-on-change')) {
          return this._committedNameChange(event)
        }

        if (event.target.classList.contains('input-checkbox-cpt') || event.target.classList.contains('value-type-select')) {
          await this._saveCurrentForm()
          await this.render({ force: true })
        }
      })

    this.element.querySelectorAll('.die-select').forEach(element => {
      element.addEventListener('mouseup', event => this._onDieRemove(event))
    })

    removeItem.call(this, this.element)
    reorderItem.call(this, this.element)
  }

  async _addNewActorType(event) {
    event.preventDefault()
    await this._saveCurrentForm()
    const source = game.settings.get('cortexprime', 'actorTypes')
    const newKey = getLength(source ?? {})
    const defaultTabId = `_tab${foundry.utils.randomID()}`

    const newActorType = {
      [newKey]: {
        hasNotesPage: true,
        id: `_${Date.now()}`,
        name: localizer('NewActorType'),
        showProfileImage: true,
        sectionLayout: {
          profile: { enabled: true, order: 0, tabId: defaultTabId, width: 'full' }
        },
        tabs: {
          0: {
            id: defaultTabId,
            label: localizer('Traits')
          }
        }
      }
    }

    await game.settings.set('cortexprime', 'actorTypes', foundry.utils.mergeObject(source, newActorType))
    await this.changeView(localizer('NewActorType'), `actorType-${newKey}`)
    await this.render({ force: true })
  }

  async _addDescriptor(event) {
    event.preventDefault()
    const { path } = event.currentTarget.dataset
    await this._saveCurrentForm()
    const source = game.settings.get('cortexprime', 'actorTypes')
    const currentDescriptors = foundry.utils.getProperty(source, path) || {}

    foundry.utils.setProperty(source, path,
      {
        ...currentDescriptors,
        [getLength(currentDescriptors ?? {})]: {
          label: localizer('NewDescriptor'),
          value: null
        }
      })

    await game.settings.set('cortexprime', 'actorTypes', source)
    await this.render({ force: true })
  }

  async _addSfx(event) {
    event.preventDefault()
    const { path } = event.currentTarget.dataset
    await this._saveCurrentForm()
    const source = game.settings.get('cortexprime', 'actorTypes')
    const currentSfx = foundry.utils.getProperty(source, path) || {}

    foundry.utils.setProperty(source, path,
      {
        ...currentSfx,
        [getLength(currentSfx ?? {})]: {
          description: null,
          label: localizer('NewSfx'),
          unlocked: true
        }
      })

    await game.settings.set('cortexprime', 'actorTypes', source)
    await this.render({ force: true })
  }

  async _addSubTrait(event) {
    event.preventDefault()
    const { path } = event.currentTarget.dataset
    await this._saveCurrentForm()
    const source = game.settings.get('cortexprime', 'actorTypes')
    const currentSubTraits = foundry.utils.getProperty(source, path) || {}


    foundry.utils.setProperty(source, path,
      {
        ...currentSubTraits,
        [getLength(currentSubTraits ?? {})]: {
          dice: { value: { 0: '8' } },
          label: localizer('NewSubTrait')
        }
      })

    await game.settings.set('cortexprime', 'actorTypes', source)
    await this.render({ force: true })
  }

  async _addTrait (event) {
    event.preventDefault()
    const { actorType, path, traitSet } = event.currentTarget.dataset
    await this._saveCurrentForm()
    const source = game.settings.get('cortexprime', 'actorTypes')
    const currentTraits = foundry.utils.getProperty(source, `${path}.${traitSet}.traits`)
    const newKey = getLength(currentTraits || {})

    const newTraits = {
      ...currentTraits,
      [newKey]: {
        id: `_${Date.now()}`,
        name: localizer('NewTrait'),
        valueType: 'die',
        dice: {
          value: {
            0: '8'
          }
        }
      }
    }

    foundry.utils.setProperty(source, `${path}.${traitSet}.traits`, newTraits)

    await game.settings.set('cortexprime', 'actorTypes', source)
    await this.changeView(localizer('NewTrait'), `trait-${actorType}-${traitSet}-${newKey}`)
    await this.render({ force: true })
  }

  async _addTraitSet (event) {
    event.preventDefault()
    const { actorType: actorTypeKey } = event.currentTarget.dataset
    await this._saveCurrentForm()
    const source = game.settings.get('cortexprime', 'actorTypes')
    const newKey = getLength(source[actorTypeKey]?.traitSets || {})
    const defaultTabId = Object.values(source[actorTypeKey]?.tabs ?? {})[0]?.id ?? 'traits'
    const traitSetId = `_${Date.now()}`
    const sectionLayout = source[actorTypeKey]?.sectionLayout ?? {}
    const nextOrder = getLength(source[actorTypeKey]?.traitSets ?? {}) + 1 + (source[actorTypeKey]?.hasPlotPoints ? 1 : 0)

    for (const layout of Object.values(sectionLayout)) {
      if (Number(layout.order) >= nextOrder) layout.order = Number(layout.order) + 1
    }

    const newTraitSet = {
      [actorTypeKey]: {
        traitSets: {
          [newKey]: {
            id: traitSetId,
            label: localizer('NewTraitSet'),
            tabId: defaultTabId
          }
        }
      }
    }

    newTraitSet[actorTypeKey].sectionLayout = {
      [traitSetId]: { enabled: true, order: nextOrder, tabId: defaultTabId, width: 'full' }
    }

    await game.settings.set('cortexprime', 'actorTypes', foundry.utils.mergeObject(source, newTraitSet))
    await this.changeView(localizer('NewTraitSet'), `traitSet-${actorTypeKey}-${newKey}`)
    await this.render({ force: true })
  }

  async _addTab (event) {
    event.preventDefault()
    const { actorType: actorTypeKey } = event.currentTarget.dataset
    await this._saveCurrentForm()
    const source = game.settings.get('cortexprime', 'actorTypes')
    const tabs = source[actorTypeKey]?.tabs ?? {}
    const newKey = getLength(tabs)

    source[actorTypeKey].tabs = {
      ...tabs,
      [newKey]: {
        id: `_tab${foundry.utils.randomID()}`,
        label: localizer('NewTab')
      }
    }

    await game.settings.set('cortexprime', 'actorTypes', source)
    await this.render({ force: true })
  }

  async _removeTab (event) {
    event.preventDefault()
    const { actorType: actorTypeKey, tab: tabKey } = event.currentTarget.dataset
    await this._saveCurrentForm()
    const source = game.settings.get('cortexprime', 'actorTypes')
    const actorType = source[actorTypeKey]
    const tabs = actorType?.tabs ?? {}

    if (getLength(tabs) <= 1) {
      ui.notifications.warn(localizer('CannotRemoveLastTab'))
      return
    }

    const tab = tabs[tabKey]
    if (!tab) return

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: localizer('AreYouSure') },
      content: `${localizer('Remove')} ${tab.label}?`,
      yes: { default: false }
    })

    if (!confirmed) return

    const remainingTabs = objectReindexFilter(tabs, (_, key) => +key !== +tabKey)
    const defaultTabId = Object.values(remainingTabs)[0].id
    const remainingTabIds = Object.values(remainingTabs).map(remainingTab => remainingTab.id)

    actorType.tabs = remainingTabs
    actorType.sectionLayout = objectMapValues(actorType.sectionLayout ?? {}, layout => ({
      ...layout,
      tabId: remainingTabIds.includes(layout.tabId) ? layout.tabId : defaultTabId
    }))
    actorType.sectionTabs = objectMapValues(actorSheetSections, (_, section) => (
      remainingTabIds.includes(actorType.sectionTabs?.[section]) ? actorType.sectionTabs[section] : defaultTabId
    ))
    actorType.traitSets = objectMapValues(actorType.traitSets ?? {}, traitSet => ({
      ...traitSet,
      tabId: remainingTabIds.includes(traitSet.tabId) ? traitSet.tabId : defaultTabId
    }))

    await game.settings.set('cortexprime', 'actorTypes', source)
    await this.render({ force: true })
  }

  async _moveSheetSection (event) {
    event.preventDefault()
    const { actorType: actorTypeKey, direction, sectionId } = event.currentTarget.dataset
    await this._saveCurrentForm()
    const source = game.settings.get('cortexprime', 'actorTypes')
    const actorType = source[actorTypeKey]
    const layout = actorType?.sectionLayout ?? {}
    const validSectionIds = new Set([
      ...PREDEFINED_ACTOR_SHEET_SECTIONS
        .filter(section => isPredefinedSectionAvailable(actorType, section.id))
        .map(section => section.id),
      ...(actorType?.simpleTraits && getLength(actorType.simpleTraits) ? ['simpleTraits'] : []),
      ...Object.values(actorType?.traitSets ?? {}).map(traitSet => traitSet.id)
    ])
    const orderedIds = Object.entries(layout)
      .filter(([id, sectionLayout]) => validSectionIds.has(id) && isSectionPlacementEnabled(sectionLayout))
      .sort(([, a], [, b]) => Number(a.order) - Number(b.order))
      .map(([id]) => id)
    const currentIndex = orderedIds.indexOf(sectionId)
    const targetIndex = currentIndex + Number(direction)

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedIds.length) return

    const targetId = orderedIds[targetIndex]
    const currentOrder = layout[sectionId].order
    layout[sectionId].order = layout[targetId].order
    layout[targetId].order = currentOrder

    await game.settings.set('cortexprime', 'actorTypes', source)
    await this.render({ force: true })
  }

  async _toggleSheetSection (event) {
    event.preventDefault()
    const { actorType: actorTypeKey, enabled, sectionId } = event.currentTarget.dataset
    await this._saveCurrentForm()
    const source = game.settings.get('cortexprime', 'actorTypes')
    const actorType = source[actorTypeKey]
    if (!actorType) return

    source[actorTypeKey] = withSectionPlacementEnabled(actorType, sectionId, enabled === 'true')

    await game.settings.set('cortexprime', 'actorTypes', source)
    await this.render({ force: true })
  }

  async _syncExistingActors (event) {
    event.preventDefault()
    const { actorType: actorTypeKey } = event.currentTarget.dataset
    if (!game.user.isGM) return

    await this._saveCurrentForm()
    const actorType = game.settings.get('cortexprime', 'actorTypes')?.[actorTypeKey]
    if (!actorType) return

    const matchingActors = actorsMatchingActorType(game.actors, actorType.id)
    if (!matchingActors.length) {
      ui.notifications.info(game.i18n.format('SyncActorsNone', { name: actorType.name }))
      return
    }

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: localizer('SyncExistingActors') },
      content: `<p>${game.i18n.format('SyncActorsQuestion', { count: matchingActors.length, name: actorType.name })}</p><p>${localizer('SyncActorsSafety')}</p>`,
      yes: { default: false }
    })
    if (!confirmed) return

    const updatedActors = await syncActorsWithActorType(actorType, matchingActors)
    ui.notifications.info(game.i18n.format('SyncActorsComplete', { count: updatedActors.length, name: actorType.name }))
  }

  async _breadcrumbChange (event) {
    event.preventDefault()
    const { to: target } = event.currentTarget.dataset
    await this._saveCurrentForm()
    const currentBreadcrumbs = game.settings.get('cortexprime', 'actorBreadcrumbs')

    const targetKey = +objectFindKey(currentBreadcrumbs, breadcrumb => breadcrumb.target === target)

    const value = objectReduce(currentBreadcrumbs, (breadcrumbs, breadcrumb, key) => {
      if (+key > targetKey) return breadcrumbs

      breadcrumb.active = breadcrumb.target === target

      return {
        ...breadcrumbs,
        [key]: breadcrumb
      }
    }, {})

    await game.settings.set('cortexprime', 'actorBreadcrumbs', value)

    await this.render({ force: true })
  }

  async _committedNameChange (event) {
    const { target } = event.target.dataset
    const { value } = event.target
    await this._saveCurrentForm()

    if (target) {
      const currentBreadcrumbs = game.settings.get('cortexprime', 'actorBreadcrumbs')
      await game.settings.set('cortexprime', 'actorBreadcrumbs', updateBreadcrumbName(currentBreadcrumbs, target, value))
    }

    await this.render({ force: true })
  }


  async _changeDefaultImage (event) {
  event.preventDefault()

  const { actorTypeIndex } = event.currentTarget.dataset
  const source = game.settings.get('cortexprime', 'actorTypes')
  const currentImage =
    source[actorTypeIndex]?.defaultImage || 'icons/svg/mystery-man.svg'

  const imagePicker = new foundry.applications.apps.FilePicker({
    type: 'image',
    current: currentImage,
    callback: async newImage => {
      source[actorTypeIndex].defaultImage = newImage

      await game.settings.set(
        'cortexprime',
        'actorTypes',
        source
      )

      await this.render({ force: true })
    }
  })

  await imagePicker.render(true)
}

  async changeView (name, target) {
    const currentBreadcrumbs = game.settings.get('cortexprime', 'actorBreadcrumbs')

    await game.settings.set('cortexprime', 'actorBreadcrumbs', {
      ...objectMapValues(currentBreadcrumbs, breadcrumb => {
        breadcrumb.active = false
        return breadcrumb
      }),
      [getLength(currentBreadcrumbs)]: {
        active: true,
        localize: false,
        name,
        target
      }
    })

    await this.render({ force: true })
  }

  async _duplicateItem (event) {
    event.preventDefault()
    const { id, path } = event.currentTarget.dataset
    await this._saveCurrentForm()
    let source = game.settings.get('cortexprime', 'actorTypes')
    const targetGroup = path ? foundry.utils.getProperty(source, path) : source
    const newKey = getLength(targetGroup ?? {})
    const target = objectFindValue(targetGroup, item => item.id === id)

    const newId = `_${Date.now()}`
    const newTarget = {
      [newKey]: objectMapValues(target, (value, key) => {
        if (key === 'id') return newId

        return value
      })
    }

    if (path) {
      foundry.utils.setProperty(source, path, { ...targetGroup, ...newTarget })
      if (path.endsWith('.traitSets')) {
        const actorTypeKey = path.split('.')[0]
        const layout = source[actorTypeKey].sectionLayout ?? {}
        const nextOrder = Math.max(-1, ...Object.values(layout).map(section => Number(section.order) || 0)) + 1
        source[actorTypeKey].sectionLayout = {
          ...layout,
          [newId]: {
            enabled: layout[id]?.enabled !== false,
            order: nextOrder,
            tabId: layout[id]?.tabId ?? Object.values(source[actorTypeKey].tabs ?? {})[0]?.id ?? 'traits',
            width: layout[id]?.width ?? 'full'
          }
        }
      }
    } else {
      source = foundry.utils.mergeObject(source, newTarget)
    }

    await game.settings.set('cortexprime', 'actorTypes', source)
    await this.render({ force: true })
  }

  async _newDie (event) {
    event.preventDefault()
    const { target: path } = event.currentTarget.dataset
    await this._saveCurrentForm()
    const source = game.settings.get('cortexprime', 'actorTypes')
    const currentDice = foundry.utils.getProperty(source, path) || {}
    const values = currentDice.value ?? {}
    const newKey = getLength(values)
    const newValue = newKey > 0 ? values[newKey - 1] : '8'

    foundry.utils.setProperty(source, `${path}.value`, { ...values, [newKey]: newValue })
    await game.settings.set('cortexprime', 'actorTypes', source)
    await this.render({ force: true })
  }

  async _onDieChange (event) {
    event.preventDefault()
    const { target, key: targetKey } = event.target.dataset
    const targetValue = event.target.value
    await this._saveCurrentForm()
    const source = game.settings.get('cortexprime', 'actorTypes')
    const currentDiceValues = foundry.utils.getProperty(source, `${target}.value`) ?? {}

    if (parseInt(targetValue, 10) === 0) {
      foundry.utils.setProperty(source, `${target}.value`, objectReindexFilter(currentDiceValues, (_, index) => parseInt(index, 10) !== parseInt(targetKey, 10)))
    } else {
      foundry.utils.setProperty(source, `${target}.value`, objectMapValues(currentDiceValues, (value, index) => parseInt(index, 10) === parseInt(targetKey, 10) ? targetValue : value))
    }

    await game.settings.set('cortexprime', 'actorTypes', source)

    await this.render({ force: true })
  }

  async _onDieRemove (event) {
    event.preventDefault()

    if (event.button === 2) {
      const { target, key: targetKey } = event.currentTarget.dataset
      await this._saveCurrentForm()
      const source = game.settings.get('cortexprime', 'actorTypes')
      const currentDiceValues = foundry.utils.getProperty(source, `${target}.value`) ?? {}

      foundry.utils.setProperty(source, `${target}.value`, objectReindexFilter(currentDiceValues, (_, index) => parseInt(index, 10) !== parseInt(targetKey, 10)))

      await game.settings.set('cortexprime', 'actorTypes', source)

      await this.render({ force: true })
    }
  }

  async _viewChange (event) {
    event.preventDefault()
    const { name, to } = event.currentTarget.dataset
    await this._saveCurrentForm()
    await this.changeView(name, to)
  }

  _openActorSettingsHelp (event) {
    event.preventDefault()
    return new CortexPrimeHelp('systems/cortexprime/templates/help/index.html').render(true)
  }

  async close (options) {
    await this._saveCurrentForm()
    const result = await super.close(options)
    await game.settings.set('cortexprime', 'actorBreadcrumbs', {
      0: {
        active: true,
        name: 'ActorTypes',
        target: 'actorTypes',
        localize: true
      }
    })
    return result
  }
}
