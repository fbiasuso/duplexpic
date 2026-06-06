class SlotConfig {
  constructor(imagePath = null, rotation = 0, mirrored = false, fitMode = 'fill') {
    this.imagePath = imagePath;
    this.rotation = rotation;
    this.mirrored = mirrored;
    this.fitMode = fitMode;
  }

  clone() {
    return new SlotConfig(this.imagePath, this.rotation, this.mirrored, this.fitMode);
  }

  isEmpty() {
    return this.imagePath === null;
  }
}

class AppState {
  constructor() {
    this.slots = { top: new SlotConfig(), bottom: new SlotConfig() };
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
    this._notify(slot, this.slots[slot]);
  }

  setMirrored(slot, mirrored) {
    this.slots[slot].mirrored = mirrored;
    this._notify(slot, this.slots[slot]);
  }

  setFitMode(slot, mode) {
    this.slots[slot].fitMode = mode;
    this._notify(slot, this.slots[slot]);
  }

  swap() {
    const temp = this.slots.top.clone();
    this.slots.top = this.slots.bottom.clone();
    this.slots.bottom = temp;
    this._notify('top', this.slots.top);
    this._notify('bottom', this.slots.bottom);
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
