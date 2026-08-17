import { getLength, objectReindexFilter } from '../../lib/helpers.js'
import { localizer } from './foundryHelpers.js'

export const addNewDataPoint = async function (data, path, value) {
  const currentData = data || {}

  await this.actor.update({
    [`data.${path}`]: {
      ...currentData,
      [getLength(currentData)]: value
    }
  })
}

export const resetDataPoint = async function (path, target, value) {
  await this.actor.update({
    [`${path}.${target}`]: foundry.data.operators.ForcedDeletion.create()
  })

  await this.actor.update({
    [`${path}.${target}`]: value
  })
}

export const toggleItems = async function (event, target = event.currentTarget) {
  event.preventDefault()
  await this._saveCurrentForm()
  const { path } = target.dataset
  const value = !foundry.utils.getProperty(this.actor, path)

  await this.actor.update({
    [path]: value
  })
}

export const removeDataPoint = async function (data, path, target, key) {
  const currentData = data || {}

  const newData = objectReindexFilter(currentData, (_, currentKey) => parseInt(currentKey, 10) !== parseInt(key, 10))

  await resetDataPoint.call(this, path, target, newData)
}

export const removeItems = async function (event, actionTarget = event.currentTarget) {
  event.preventDefault()
  await this._saveCurrentForm()
  const {
    path,
    itemKey,
    itemName,
    target
  } = actionTarget.dataset

  let confirmed

  await Dialog.confirm({
    title: localizer('AreYouSure'),
    content: `${localizer('Remove')} ${itemName}?`,
    yes: () => { confirmed = true },
    no: () => { confirmed = false },
    defaultYes: false
  })

  if (confirmed) {
    const data = foundry.utils.getProperty(this.actor, `${path}.${target}`)

    await removeDataPoint.call(this, data, path, target, itemKey)
  }
}
