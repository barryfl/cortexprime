import { CortexPrimeApplication } from '../applications/CortexPrimeApplication.js'
import { localizer } from '../scripts/foundryHelpers.js'
import { planOrphanDeletion, scanSavedPools } from './savedPoolCleanup.js'

const collectionValues = collection => collection?.contents ?? Array.from(collection ?? [])

export default class SavedPoolCleanupSettings extends CortexPrimeApplication {
  static DEFAULT_OPTIONS = {
    id: 'saved-pool-cleanup-settings',
    classes: ['cortexprime', 'cortexprime-application', 'saved-pool-cleanup-settings'],
    actions: {
      deleteSelected: function (event) { return this._deleteSelected(event) },
      selectAllUnused: function (event) { return this._selectAllUnused(event) }
    },
    position: {
      width: 600,
      height: 700
    }
  }

  static PARTS = {
    cleanup: { template: 'systems/cortexprime/templates/saved-pool-cleanup.html' }
  }

  get title () {
    return localizer('SavedPoolCleanup')
  }

  async _prepareContext (options) {
    const context = await super._prepareContext(options)
    if (!game.user.isGM) return { ...context, groups: [], isGM: false }
    return {
      ...context,
      groups: scanSavedPools(collectionValues(game.users), collectionValues(game.macros)),
      isGM: true
    }
  }

  _selectAllUnused (event) {
    event.preventDefault()
    if (!game.user.isGM) return false
    for (const checkbox of this.element.querySelectorAll('input[name="orphanedPool"]')) checkbox.checked = true
    return true
  }

  async _deleteSelected (event) {
    event.preventDefault()
    if (!game.user.isGM) return false

    const selectedKeys = Array.from(this.element.querySelectorAll('input[name="orphanedPool"]:checked'), input => input.value)
    const users = collectionValues(game.users)
    const plan = planOrphanDeletion(users, collectionValues(game.macros), selectedKeys)
    if (!plan.deleted) return false

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: localizer('AreYouSure') },
      content: `<p>${game.i18n.format('DeleteSavedPoolsConfirmation', { count: plan.deleted })}</p><p>${localizer('SavedPoolMacrosUnaffected')}</p>`,
      yes: { default: false }
    })
    if (!confirmed) return false

    for (const { user, savedPools } of plan.updates) {
      await user.setFlag('cortexprime', 'savedPools', null)
      await user.setFlag('cortexprime', 'savedPools', savedPools)
    }

    ui.notifications.info(game.i18n.format('DeletedSavedPools', { count: plan.deleted }))
    await this._renderPreservingScroll()
    return true
  }
}
