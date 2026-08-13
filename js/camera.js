window.viewSize = function viewSize() {
  const vv = window.visualViewport;
  if (vv && vv.width && vv.height) {
    return { w: vv.width, h: vv.height, left: vv.offsetLeft || 0, top: vv.offsetTop || 0 };
  }
  return { w: window.innerWidth, h: window.innerHeight, left: 0, top: 0 };
};

/**
 * 世界摄像机：跟着角色平移 / 缩放，方便以后加房间、道具、NPC。
 * 角色坐标在世界里，屏幕只是摄像机看到的那一块。
 */
window.Camera = class Camera {
  constructor(worldEl, options = {}) {
    this.worldEl = worldEl;
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.targetZoom = 1;
    this.smoothing = options.smoothing ?? 0.12;
    this.zoomSmoothing = options.zoomSmoothing ?? 0.08;
    this.lookAhead = 0;
    this.maxLookAhead = options.maxLookAhead ?? 140;
    this.enabled = true;
    this.bounds = { x: 0, y: 0, w: 0, h: 0 };
    this.shakePower = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.target = null;
    this.hudInset = 0;
  }

  setHudInset(px) {
    this.hudInset = Math.max(0, px || 0);
  }

  visibleSize() {
    const view = viewSize();
    return {
      w: view.w,
      h: Math.max(1, view.h - this.hudInset),
      left: view.left,
      top: view.top,
    };
  }

  nudge(screenDx, screenDy) {
    this.x -= screenDx / this.zoom;
    this.y -= screenDy / this.zoom;
    this.clamp();
    this.apply();
  }

  setTarget(entity) {
    this.target = entity;
  }

  setBounds(x, y, w, h) {
    this.bounds = { x, y, w, h };
  }

  setEnabled(on) {
    this.enabled = on;
  }

  setZoom(zoom) {
    const max = viewSize().w < 768 ? 1.06 : 1.6;
    this.targetZoom = Math.min(max, Math.max(0.85, zoom));
  }

  shake(power = 6) {
    this.shakePower = Math.max(this.shakePower, power);
  }

  screenToWorld(sx, sy) {
    const view = this.visibleSize();
    return {
      x: (sx - view.left - view.w / 2) / this.zoom + this.x,
      y: (sy - view.top - view.h / 2) / this.zoom + this.y,
    };
  }

  worldToScreen(wx, wy) {
    const view = this.visibleSize();
    return {
      x: (wx - this.x) * this.zoom + view.w / 2 + view.left,
      y: (wy - this.y) * this.zoom + view.h / 2 + view.top,
    };
  }

  snapToTarget() {
    if (!this.target) return;
    this.x = this.target.x + this.target.w / 2;
    this.y = this.target.y + this.target.h * 0.42;
    this.clamp();
    this.apply();
  }

  clamp() {
    const view = this.visibleSize();
    const vw = view.w / this.zoom;
    const vh = view.h / this.zoom;
    const minX = this.bounds.x + vw / 2;
    const maxX = this.bounds.x + this.bounds.w - vw / 2;
    const minY = this.bounds.y + vh / 2;
    const maxY = this.bounds.y + this.bounds.h - vh / 2;
    this.x = maxX < minX ? (this.bounds.x + this.bounds.w / 2) : Math.min(maxX, Math.max(minX, this.x));
    this.y = maxY < minY ? (this.bounds.y + this.bounds.h / 2) : Math.min(maxY, Math.max(minY, this.y));
  }

  update(dt) {
    const k = 1 - Math.pow(1 - this.smoothing, dt * 60);
    const zk = 1 - Math.pow(1 - this.zoomSmoothing, dt * 60);
    this.zoom += (this.targetZoom - this.zoom) * zk;

    if (this.enabled && this.target) {
      const dir = this.target.dir || 0;
      const look = Math.min(this.maxLookAhead, this.visibleSize().w * 0.18);
      const wantLook = (this.target.state === "walk" ? dir : 0) * look;
      this.lookAhead += (wantLook - this.lookAhead) * k;
      const tx = this.target.x + this.target.w / 2 + this.lookAhead;
      const ty = this.target.y + this.target.h * 0.42;
      this.x += (tx - this.x) * k;
      this.y += (ty - this.y) * k;
    }

    if (this.shakePower > 0.2) {
      this.shakeX = (Math.random() - 0.5) * this.shakePower;
      this.shakeY = (Math.random() - 0.5) * this.shakePower;
      this.shakePower *= 0.86;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
      this.shakePower = 0;
    }

    this.clamp();
    this.apply();
  }

  apply() {
    const view = this.visibleSize();
    const tx = view.w / 2 - (this.x + this.shakeX) * this.zoom;
    const ty = view.h / 2 - (this.y + this.shakeY) * this.zoom;
    this.worldEl.style.transform = `translate(${tx}px, ${ty}px) scale(${this.zoom})`;
  }
};
