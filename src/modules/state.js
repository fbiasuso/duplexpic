class AppState {
  constructor() {
    this.slots = { top: null, bottom: null };
    this._listeners = [];
  }

  setImage(slot, path) {
    this.slots[slot] = path;
    this._notify(slot, path);
  }

  clearSlot(slot) {
    this.slots[slot] = null;
    this._notify(slot, null);
  }

  getImage(slot) {
    return this.slots[slot];
  }

  isEmpty(slot) {
    return this.slots[slot] === null;
  }

  onChange(callback) {
    this._listeners.push(callback);
  }

  _notify(slot, value) {
    this._listeners.forEach(cb => cb(slot, value));
  }
}

export const appState = new AppState();
