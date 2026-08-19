export class ScrollPreservation {
  constructor (selector = '.window-content') {
    this.selector = selector
    this._pending = null
  }

  _findContainer (root, selector = this.selector) {
    if (!root) return null
    if (root.matches?.(selector)) return root
    return root.querySelector?.(selector) ?? null
  }

  preserve (root, selector = this.selector) {
    const container = this._findContainer(root, selector)
    if (!container) return false
    this._pending = { selector, scrollTop: container.scrollTop }
    return true
  }

  restore (root) {
    if (!this._pending) return false
    const { selector, scrollTop } = this._pending
    this._pending = null
    const container = this._findContainer(root, selector)
    if (!container) return false
    container.scrollTop = scrollTop
    return true
  }

  clear () {
    this._pending = null
  }
}
