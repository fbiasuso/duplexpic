class SlotConfig {
  constructor(imagePath = null, rotation = 0, mirrored = false, fitMode = 'contain') {
    this.imagePath = imagePath;
    this.rotation = rotation;
    this.mirrored = mirrored;
    this.fitMode = fitMode;
    this.transformedUrl = null;
  }

  clone() {
    const c = new SlotConfig(this.imagePath, this.rotation, this.mirrored, this.fitMode);
    c.transformedUrl = this.transformedUrl;
    return c;
  }

  isEmpty() {
    return this.imagePath === null;
  }
}

class AppState {
  constructor() {
    this.slots = { 'slot-top': new SlotConfig(), 'slot-bottom': new SlotConfig() };
    this._listeners = [];
  }

  setImage(slot, path) {
    this.slots[slot] = new SlotConfig(path);
    this._notify(slot, this.slots[slot]);
  }

  clearSlot(slot) {
    this.slots[slot] = new SlotConfig();
    this._notify(slot, this.slots[slot]);
  }

  setRotation(slot, degrees) {
    this.slots[slot].rotation = degrees;
    this.slots[slot].transformedUrl = null;
    this._notify(slot, this.slots[slot]);
  }

  setMirrored(slot, mirrored) {
    this.slots[slot].mirrored = mirrored;
    // Keep transformedUrl — mirror is now CSS-only, no need to re-process in Rust
    this._notify(slot, this.slots[slot]);
  }

  setFitMode(slot, mode) {
    this.slots[slot].fitMode = mode;
    this._notify(slot, this.slots[slot]);
  }

  swap() {
    const temp = this.slots['slot-top'].clone();
    this.slots['slot-top'] = this.slots['slot-bottom'].clone();
    this.slots['slot-bottom'] = temp;
    this._notify('slot-top', this.slots['slot-top']);
    this._notify('slot-bottom', this.slots['slot-bottom']);
  }

  getImage(slot) {
    return this.slots[slot].imagePath;
  }

  isEmpty(slot) {
    return this.slots[slot].isEmpty();
  }

  onChange(callback) {
    this._listeners.push(callback);
  }

  _notify(slot, config) {
    this._listeners.forEach(cb => cb(slot, config));
  }
}

export const appState = new AppState();
