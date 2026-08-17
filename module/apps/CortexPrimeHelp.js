const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

export class CortexPrimeHelp extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor (templatePath, options = {}) {
    super(options)
    this.templatePath = templatePath
  }

  static DEFAULT_OPTIONS = {
    id: 'cortexprime-help',
    tag: 'form',
    window: {
      title: 'Cortex Prime Help',
      resizable: true
    },
    position: {
      width: 700,
      height: 700
    }
  }

  static PARTS = {
    main: {
      template: 'systems/cortexprime/templates/help/index.html'
    }
  }

  _configureRenderParts (options) {
    const parts = super._configureRenderParts(options)

    parts.main.template = this.templatePath

    return parts
  }
}
