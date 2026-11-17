// Keyboard and mouse state. Keys are tracked by code; `pressed` fires once
// per keydown. Mouse position is kept in screen space and converted to world
// space by the caller (the camera is known only to the game).

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mousePressed = false;
    this.canvas = canvas;
    this.onFirstGesture = null;
    this._gestured = false;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      this._gesture();
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
    });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left;
      this.mouseY = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.mouseDown = true;
      this.mousePressed = true;
      this._gesture();
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _gesture() {
    if (!this._gestured) {
      this._gestured = true;
      if (this.onFirstGesture) this.onFirstGesture();
    }
  }

  down(code) {
    return this.keys.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  /** Axis from a pair of keys, -1..1. */
  axis(neg, pos) {
    return (this.keys.has(pos) ? 1 : 0) - (this.keys.has(neg) ? 1 : 0);
  }

  /** Call once per frame after the game has read the input. */
  endFrame() {
    this.pressed.clear();
    this.mousePressed = false;
  }
}
