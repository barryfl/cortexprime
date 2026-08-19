import { CortexPrimeApplication } from '../applications/CortexPrimeApplication.js'

export class CortexPrimeHelp extends CortexPrimeApplication {
  constructor (
    templatePath = 'systems/cortexprime/templates/help/index.html',
    options = {}
  ) {
    super(options)
    this.templatePath = templatePath
  }

  static DEFAULT_OPTIONS = {
    id: 'cortexprime-help',
    window: {
      title: 'Cortex Prime Help'
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

  async _onRender (context, options) {
    await super._onRender(context, options)

    const pages = {
      index: 'index.html',
      actorSettings: 'actor-settings.html',
      traits: 'traits.html',
      dicePools: 'dice-pools.html',
      plotPoints: 'plot-points.html'
    }

    for (const [action, file] of Object.entries(pages)) {
      this.element
        .querySelectorAll(`[data-action="${action}"]`)
        .forEach(element => {
          element.addEventListener('click', async event => {
            event.preventDefault()

            this.templatePath =
              `systems/cortexprime/templates/help/${file}`

            this._discardPreservedScroll()
            await this.render({ force: true })
          })
        })
    }
  }
}
