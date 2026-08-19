import { ScrollPreservation } from './scrollPreservation.js'

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

export class CortexPrimeApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  _scrollPreservation = new ScrollPreservation('.window-content')

  static DEFAULT_OPTIONS = {
    classes: ['cortexprime', 'cortexprime-application'],
    window: {
      resizable: true
    }
  }

  _preserveScroll (selector = '.window-content') {
    return this._scrollPreservation.preserve(this.element, selector)
  }

  _restoreScroll () {
    return this._scrollPreservation.restore(this.element)
  }

  _discardPreservedScroll () {
    this._scrollPreservation.clear()
  }

  async _renderPreservingScroll (options = { force: true }, selector = '.window-content') {
    this._preserveScroll(selector)
    return this.render(options)
  }

  async _onRender (context, options) {
    await super._onRender(context, options)
    this._restoreScroll()
  }

  async close (options = {}) {
    this._discardPreservedScroll()
    return super.close(options)
  }
}
