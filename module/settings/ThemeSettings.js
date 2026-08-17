import { localizer, setCssVars } from '../scripts/foundryHelpers.js'
import defaultThemes from '../theme/defaultThemes.js'

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

export default class ThemeSettings extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'theme-settings',
    tagName: 'form',
    classes: ['cortexprime', 'theme-settings'],
    form: {
      closeOnSubmit: false,
      handler: function () { return this._saveForm() }
    },
    position: {
      width: 960,
      height: 900,
      top: 200,
      left: 400
    },
    window: { resizable: true }
  }

  static PARTS = {
    settings: { template: 'systems/cortexprime/templates/theme/settings.html' }
  }

  get title () {
    return localizer('ThemeSettings')
  }

  async _prepareContext (options) {
    const context = await super._prepareContext(options)
    const themes = game.settings.get('cortexprime', 'themes')

    return {
      ...context,
      themes,
      defaultVersion: defaultThemes.version
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
    const formData = this._getFormData()
    const expandedFormData = foundry.utils.expandObject(formData)
    const currentThemes = game.settings.get('cortexprime', 'themes') ?? {}

    expandedFormData.themes.currentSettings = currentThemes.current !== expandedFormData.themes.current
      ? expandedFormData.themes.current === 'custom'
        ? currentThemes.custom
        : currentThemes.list[expandedFormData.themes.current]
      : expandedFormData.themes.currentSettings

    await game.settings.set('cortexprime', 'themes', foundry.utils.mergeObject(currentThemes, expandedFormData.themes))

    const themes = game.settings.get('cortexprime', 'themes')
    const theme = themes.current === 'custom' ? themes.custom : themes.list[themes.current]

    setCssVars(theme)

    if (render) await this.render({ force: true })
  }

  async _onRender (context, options) {
    await super._onRender(context, options)
    this.element.addEventListener('change', () => this._saveForm())
    this.element.querySelectorAll('.image-picker').forEach(element => element.addEventListener('click', event => this._changeImage(event)))
    this.element.querySelectorAll('.image-remove').forEach(element => element.addEventListener('click', event => this._removeImage(event)))
    this.element.querySelector('.refresh-preset')?.addEventListener('click', event => this._refreshPreset(event))
    this.element.querySelector('.save-as-custom-preset')?.addEventListener('click', event => this._saveAsCustomPreset(event))
    this.element.querySelector('.update-presets')?.addEventListener('click', event => this._updatePresets(event))
  }

  async _changeImage (event) {
    event.preventDefault()
    const { targetSetting } = event.currentTarget.dataset
    const source = game.settings.get('cortexprime', 'themes')
    const currentImage = source?.currentSettings?.[targetSetting] || null
    const _this = this

    const imagePicker = await new FilePicker({
      type: 'image',
      current: currentImage,
      async callback (newImage) {
        source.currentSettings[targetSetting] = newImage

        await game.settings.set('cortexprime', 'themes', source)

        await _this.render({ force: true })
      }
    })

    await imagePicker.render()
  }

  async _removeImage (event) {
    event.preventDefault()
    const { targetSetting } = event.currentTarget.dataset
    const source = game.settings.get('cortexprime', 'themes')
    source.currentSettings[targetSetting] = null

    await game.settings.set('cortexprime', 'themes', source)

    await this.render({ force: true })
  }

  async _refreshPreset (event) {
    event.preventDefault()
    const source = game.settings.get('cortexprime', 'themes')
    source.currentSettings = source.current === 'custom'
      ? source.custom
      : source.list[source.current]

    await game.settings.set('cortexprime', 'themes', source)

    const themes = game.settings.get('cortexprime', 'themes')
    const theme = themes.current === 'custom' ? themes.custom : themes.list[themes.current]

    setCssVars(theme)

    await this.render({ force: true })
  }

  async _saveAsCustomPreset (event) {
    event.preventDefault()
    const source = game.settings.get('cortexprime', 'themes')
    source.current = 'custom'
    source.custom = source.currentSettings

    await game.settings.set('cortexprime', 'themes', source)

    const themes = game.settings.get('cortexprime', 'themes')
    const theme = themes.current === 'custom' ? themes.custom : themes.list[themes.current]

    setCssVars(theme)

    await this.render({ force: true })
  }

  async _updatePresets (event) {
    event.preventDefault()
    const source = game.settings.get('cortexprime', 'themes')

    source.current = source.current !== 'custom'
      ? source[source.current] || defaultThemes.current
      : 'custom'
    source.list = defaultThemes.list
    source.version = defaultThemes.version
    source.currentSettings = source.current === 'custom'
      ? source.custom
      : source.list[source.current]

    await game.settings.set('cortexprime', 'themes', source)

    const themes = game.settings.get('cortexprime', 'themes')
    const theme = themes.current === 'custom' ? themes.custom : themes.list[themes.current]

    setCssVars(theme)

    await this.render({ force: true })
  }

  async close (options) {
    if (this.rendered) await this._saveForm({ render: false })
    return super.close(options)
  }
}
