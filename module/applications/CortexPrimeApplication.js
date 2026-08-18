const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

export class CortexPrimeApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ['cortexprime'],
    window: {
      resizable: true
    }
  }
}
