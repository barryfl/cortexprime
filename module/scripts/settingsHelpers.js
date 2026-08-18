import { getLength, objectMapKeys, objectReduce, objectReindexFilter } from '../../lib/helpers.js'
import { localizer } from './foundryHelpers.js'

export const collapseToggle = function (element) {
  element.querySelectorAll('.collapse-toggle').forEach(toggle => toggle.addEventListener('click', async event => {
    event.preventDefault()
    const collapseValue = event.currentTarget.nextElementSibling

    if (collapseValue?.classList.contains('collapse-value')) {
      collapseValue.checked = !collapseValue.checked
    }

    await this._saveCurrentForm()
    await this.render({ force: true })
  }))
}

export const displayToggle = element => {
  element.querySelectorAll('input.display-toggle').forEach(toggle => toggle.addEventListener('change', event => {
    event.preventDefault()
    const { scope, selector } = event.currentTarget.dataset
    const targetElements = scope
      ? event.currentTarget.closest(scope)?.querySelectorAll(selector) ?? []
      : element.querySelectorAll(selector)

    for (const targetElement of targetElements) {
      targetElement.hidden = !targetElement.hidden
    }
  }))
}

export const removeItem = function (element) {
  element.querySelectorAll('.remove-item').forEach(removeButton => removeButton.addEventListener('click', async event => {
    event.preventDefault()
    await this._saveCurrentForm()
    const {
      group,
      itemKey,
      itemName,
      setting,
      stayOnPage
    } = event.currentTarget.dataset

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: localizer('AreYouSure')
      },
      content: `${localizer('Remove')} ${itemName}?`,
      yes: {
        default: false
      }
    })

    if (confirmed) {
      if (setting) {
        let settings = game.settings.get('cortexprime', setting)

        const currentGroupSettings = group ? await foundry.utils.getProperty(settings, group) : settings
        const groupSettingValue = objectReindexFilter(currentGroupSettings, (_, key) => +key !== +itemKey)

        if (group) {
          foundry.utils.setProperty(settings, group, groupSettingValue)
        } else {
          settings = groupSettingValue
        }
        await game.settings.set('cortexprime', setting, settings)

        if (setting === 'actorTypes' && !stayOnPage) {
          const currentBreadcrumbs = game.settings.get('cortexprime', 'actorBreadcrumbs')

          const breadcrumbsValue = objectReduce(currentBreadcrumbs, (acc, value, key, length) => {
            if (+key === length - 1) return acc
            return {
              ...acc,
              [key]: {
                ...value,
                active: +key === (length - 2)
              }
            }
          }, {})

          await game.settings.set('cortexprime', 'actorBreadcrumbs', breadcrumbsValue)
        }

        await this.render({ force: true })
      }
    }
  }))
}

export const reorderItem = function (element) {
  element.querySelectorAll('.reorder').forEach(reorderButton => reorderButton.addEventListener('click', async event => {
    event.preventDefault()
    const reorderTarget = event.currentTarget
    await this._saveCurrentForm()
    const {
      currentIndex,
      newIndex,
      path,
      setting
    } = reorderTarget.dataset

    let settings = game.settings.get('cortexprime', setting)
    const targetObject = (path || parseInt(path, 10) === 0) ? foundry.utils.getProperty(settings, path) ?? {} : settings
    const maxKey = getLength(targetObject ?? {}) - 1

    const key = +newIndex < 0
      ? maxKey
      : maxKey < +newIndex
        ? 0
        : +newIndex

    const value = objectMapKeys(targetObject, (_, targetKey) => {
      return +targetKey === +currentIndex
        ? key
        : +currentIndex > key
          ? +targetKey < +currentIndex && +targetKey >= key
            ? +targetKey + 1
            : +targetKey
          : +targetKey > +currentIndex && +targetKey <= key
            ? +targetKey - 1
            : +targetKey
    })

    if (path || parseInt(path, 10) === 0) {
      foundry.utils.setProperty(settings, path, value)
    } else {
      settings = value
    }

    await game.settings.set('cortexprime', setting, settings)
    await this.render({ force: true })
  }))
}
