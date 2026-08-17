import { localizer } from '../scripts/foundryHelpers.js'
import { getLength, objectFindKey, objectFindValue, objectMapValues, objectReduce, objectReindexFilter } from '../../lib/helpers.js'
import { removeItem, reorderItem } from '../scripts/settingsHelpers.js'

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

export default class ActorSettings extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'actor-settings',
    tagName: 'form',
    classes: ['cortexprime', 'actor-settings'],
    form: {
      closeOnSubmit: false,
      handler: function () { return this._saveForm() }
    },
    position: {
      width: 600,
      height: 900,
      top: 200,
      left: 400
    },
    window: { resizable: true }
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

    return {
      ...context,
      actorTypes: game.settings.get('cortexprime', 'actorTypes'),
      breadcrumbs,
      goBack: breadcrumbs[getLength(breadcrumbs ?? {}) - 2]?.target ?? 0
    }
  }

  _getFormData () {
    const formData = new FormData(this.element)
    const data = Object.fromEntries(formData.entries())
    for (const checkbox of this.element.querySelectorAll('input[type="checkbox"][name]')) {
      data[checkbox.name] = checkbox.checked
    }
    for (const numberInput of this.element.querySelectorAll('input[type="number"][name]')) {
      data[numberInput.name] = numberInput.valueAsNumber
    }
    return data
  }

  async _saveForm ({ render = true } = {}) {
    if (!this.rendered) return
    const expandedFormData = foundry.utils.expandObject(this._getFormData())
    const currentActorTypes = game.settings.get('cortexprime', 'actorTypes') ?? {}

    await game.settings.set('cortexprime', 'actorTypes', foundry.utils.mergeObject(currentActorTypes, expandedFormData.actorTypes ?? {}))

    if (render) await this.render({ force: true })
  }

  async _onRender (context, options) {
    await super._onRender(context, options)

    const clickHandlers = {
      '#add-new-actor-type': this._addNewActorType,
      '.add-descriptor': this._addDescriptor,
      '.add-simple-trait': this._addSimpleTrait,
      '.add-sfx': this._addSfx,
      '.add-sub-trait': this._addSubTrait,
      '.add-trait': this._addTrait,
      '.add-trait-set': this._addTraitSet,
      '.breadcrumb:not(.active), .go-back': this._breadcrumbChange,
      '.default-image': this._changeDefaultImage,
      '.duplicate-item': this._duplicateItem,
      '.new-die': this._newDie,
      '.view-change': this._viewChange
    }

    for (const [selector, handler] of Object.entries(clickHandlers)) {
      this.element.querySelectorAll(selector).forEach(element => {
        element.addEventListener('click', event => handler.call(this, event))
      })
    }

    this.element.addEventListener('change', async event => {
      if (event.target.classList.contains('die-select')) return this._onDieChange(event)
      if (event.target.classList.contains('breadcrumb-name-change')) await this._breadcrumbNameChange(event)
      await this._saveForm()
    })

    this.element.querySelectorAll('.die-select').forEach(element => {
      element.addEventListener('mouseup', event => this._onDieRemove(event))
    })

    removeItem.call(this, this.element)
    reorderItem.call(this, this.element)
  }

  async _addNewActorType(event) {
    event.preventDefault()
    const source = game.settings.get('cortexprime', 'actorTypes')
    const newKey = getLength(source ?? {})

    const newActorType = {
      [newKey]: {
        hasNotesPage: true,
        id: `_${Date.now()}`,
        name: localizer('NewActorType'),
        showProfileImage: true
      }
    }

    await game.settings.set('cortexprime', 'actorTypes', foundry.utils.mergeObject(source, newActorType))
    await this.changeView(localizer('NewActorType'), `actorType-${newKey}`)
    await this.render({ force: true })
  }

  async _addDescriptor(event) {
    event.preventDefault()
    const { path } = event.currentTarget.dataset
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

  async _addSimpleTrait (event) {
    event.preventDefault()
    const source = game.settings.get('cortexprime', 'actorTypes')
    const { actorType: actorTypeKey } = event.currentTarget.dataset
    const newKey = getLength(source[actorTypeKey]?.simpleTraits || {})

    const newSimpleTrait = {
      [actorTypeKey]: {
        simpleTraits: {
          [newKey]: {
            dice: {
              value: {
                0: '8'
              }
            },
            id: `_${Date.now()}`,
            label: localizer('NewSimpleTrait'),
            settings: {
              editable: true,
              valueType: 'text'
            }
          }
        }
      }
    }

    await game.settings.set('cortexprime', 'actorTypes', foundry.utils.mergeObject(source, newSimpleTrait))
    await this.changeView(localizer('NewSimpleTrait'), `simpleTrait-${actorTypeKey}-${newKey}`)
    await this.render({ force: true })
  }

  async _addTrait (event) {
    event.preventDefault()
    const source = game.settings.get('cortexprime', 'actorTypes')
    const { actorType, path, traitSet } = event.currentTarget.dataset
    const currentTraits = foundry.utils.getProperty(source, `${path}.${traitSet}.traits`)
    const newKey = getLength(currentTraits || {})

    const newTraits = {
      ...currentTraits,
      [newKey]: {
        id: `_${Date.now()}`,
        name: localizer('NewTrait'),
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
    const source = game.settings.get('cortexprime', 'actorTypes')
    const { actorType: actorTypeKey } = event.currentTarget.dataset
    const newKey = getLength(source[actorTypeKey]?.traitSets || {})

    const newTraitSet = {
      [actorTypeKey]: {
        traitSets: {
          [newKey]: {
            id: `_${Date.now()}`,
            label: localizer('NewTraitSet')
          }
        }
      }
    }

    await game.settings.set('cortexprime', 'actorTypes', foundry.utils.mergeObject(source, newTraitSet))
    await this.changeView(localizer('NewTraitSet'), `traitSet-${actorTypeKey}-${newKey}`)
    await this.render({ force: true })
  }

  async _breadcrumbChange (event) {
    const currentBreadcrumbs = game.settings.get('cortexprime', 'actorBreadcrumbs')

    const { to: target } = event.currentTarget.dataset

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

    await this._saveForm({ render: false })
    await this.render({ force: true })
  }

  async _breadcrumbNameChange (event) {
    const { target } = event.target.dataset
    const currentBreadcrumbs = game.settings.get('cortexprime', 'actorBreadcrumbs')

    await game.settings.set('cortexprime', 'actorBreadcrumbs', {
      ...objectMapValues(currentBreadcrumbs, breadcrumb => {
        if (breadcrumb.target === target) {
          breadcrumb.name = event.target.value
        }

        return breadcrumb
      })
    })
  }

  async _changeDefaultImage (event) {
    event.preventDefault()
    const { actorTypeIndex } = event.currentTarget.dataset
    const source = game.settings.get('cortexprime', 'actorTypes')
    const currentImage = source[actorTypeIndex]?.defaultImage || 'icons/svg/mystery-man.svg'
    const _this = this

    const imagePicker = await new FilePicker({
      type: 'image',
      current: currentImage,
      async callback (newImage) {
        source[actorTypeIndex].defaultImage = newImage

        await game.settings.set('cortexprime', 'actorTypes', source)

        await _this.render({ force: true })
      }
    })

    await imagePicker.render()
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
    let source = game.settings.get('cortexprime', 'actorTypes')
    const targetGroup = path ? foundry.utils.getProperty(source, path) : source
    const newKey = getLength(targetGroup ?? {})
    const target = objectFindValue(targetGroup, item => item.id === id)

    const newTarget = {
      [newKey]: objectMapValues(target, (value, key) => {
        if (key === 'id') return `_${Date.now()}`

        return value
      })
    }

    if (path) {
      foundry.utils.setProperty(source, path, { ...targetGroup, ...newTarget })
    } else {
      source = foundry.utils.mergeObject(source, newTarget)
    }

    await game.settings.set('cortexprime', 'actorTypes', source)
    await this.render({ force: true })
  }

  async _newDie (event) {
    event.preventDefault()
    const source = game.settings.get('cortexprime', 'actorTypes')
    const { target: path } = event.currentTarget.dataset
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
    const source = game.settings.get('cortexprime', 'actorTypes')
    const { target, key: targetKey } = event.target.dataset
    const targetValue = event.target.value
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
      const source = game.settings.get('cortexprime', 'actorTypes')
      const { target, key: targetKey } = event.currentTarget.dataset
      const currentDiceValues = foundry.utils.getProperty(source, `${target}.value`) ?? {}

      foundry.utils.setProperty(source, `${target}.value`, objectReindexFilter(currentDiceValues, (_, index) => parseInt(index, 10) !== parseInt(targetKey, 10)))

      await game.settings.set('cortexprime', 'actorTypes', source)

      await this.render({ force: true })
    }
  }

  async _viewChange (event) {
    event.preventDefault()
    const { name, to } = event.currentTarget.dataset
    await this.changeView(name, to)
  }

  async close (options) {
    if (this.rendered) await this._saveForm({ render: false })
    await game.settings.set('cortexprime', 'actorBreadcrumbs', {
      0: {
        active: true,
        name: 'ActorTypes',
        target: 'actorTypes',
        localize: true
      }
    })
    return super.close(options)
  }
}
