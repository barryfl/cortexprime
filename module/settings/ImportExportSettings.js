import defaultActorTypes from "../actor/defaultActorTypes.js"
import { localizer, setCssVars } from "../scripts/foundryHelpers.js"

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

export default class ImportExportSettings extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'import-export-settings',
    tag: 'form',
    classes: ['cortexprime', 'import-export-settings'],
    form: {
      closeOnSubmit: false,
      submitOnChange: true,
      submitOnClose: true,
      handler: function () {}
    },
    position: {
      width: 'auto',
      height: 'auto',
      top: 200,
      left: 400
    },
    window: { resizable: true }
  }

  static PARTS = {
    settings: { template: 'systems/cortexprime/templates/import-export-settings.html' }
  }

  get title () {
    return localizer('ImportExportSettings')
  }

  async _prepareContext (options) {
    const context = await super._prepareContext(options)
    return { ...context, ...game.settings.get('cortexprime', 'importedSettings') }
  }

  async _onRender (context, options) {
    await super._onRender(context, options)
    this.element.querySelector('.export-settings')?.addEventListener('click', event => this._exportSettings(event))
    this.element.querySelector('.import-settings')?.addEventListener('change', event => this._importSettings(event))
    this.element.querySelector('.reset-settings')?.addEventListener('click', event => this._resetSettings(event))
  }

  async _exportSettings(event) {
    event.preventDefault()

    const { current, custom } = await game.settings.get('cortexprime', 'themes')

    const settings = {
      actorTypes: game.settings.get('cortexprime', 'actorTypes'),
      cortexPrimeVersion: game.system.version,
      theme: { current, custom }
    }

 foundry.utils.saveDataToFile(JSON.stringify(settings), 'json', 'my-cortex-prime-settings.json')
  }

  async _importSettings(event) {
    event.preventDefault()
    const file = event.currentTarget.files?.[0]

    if (file) {
      const fileReader = new FileReader()

      fileReader.onload = async () => {
        let data
        let warning

        try {
          data = JSON.parse(fileReader.result)
        } catch (error) {
          console.error(error)
          ui.notifications.error(localizer('CantReadImportFile'))
          return
        }

        if (!data?.cortexPrimeVersion && !data?.actorTypes) {
          ui.notifications.error(localizer('CantReadImportFile'))
          return
        }

        if (game.system.version !== data?.cortexPrimeVersion) {
          warning = localizer('ImportVersionWarning')
        }

        let confirmed

        await Dialog.confirm({
          title: localizer('AreYouSure'),
          content: `<div>${warning ? '<p class="my-2 pa-2 ba-2-primary">' + warning + '</p>' : ''}<p class="my-2">${localizer('ConfirmImportMessage')}</p></div>`,
          yes: () => { confirmed = true },
          no: () => { confirmed = false },
          defaultYes: false
        })

        if (confirmed) {
          await game.settings.set('cortexprime', 'importedSettings', { currentSetting: file.name })
          await game.settings.set('cortexprime', 'actorTypes', data.actorTypes)

          const themeSettings = await game.settings.get('cortexprime', 'themes')

          const { current, custom } = data.theme ?? {}

          themeSettings.current = current ?? 'Default'
          themeSettings.custom = custom ?? themeSettings.custom

          await game.settings.set('cortexprime', 'themes', themeSettings)

          const theme = themeSettings.current === 'custom' ? themeSettings.custom : themeSettings.list[themeSettings.current]

          setCssVars(theme)

          ui.notifications.info(localizer('ImportSuccessMessage'))

          await this.render({ force: true })
        }
      }

      fileReader.readAsText(file)
    }
  }

  async _resetSettings (event) {
    event.preventDefault()

    let confirmed

    await Dialog.confirm({
      title: localizer('AreYouSure'),
      content: localizer('ConfirmResetSettingsMessage'),
      yes: () => { confirmed = true },
      no: () => { confirmed = false },
      defaultYes: false
    })

    if (confirmed) {
      await game.settings.set('cortexprime', 'importedSettings', { currentSetting: localizer('Default') })
      await game.settings.set('cortexprime', 'actorTypes', defaultActorTypes)
      ui.notifications.info(localizer('ResetSuccessMessage'))

      await this.render({ force: true })
    }
  }
}
