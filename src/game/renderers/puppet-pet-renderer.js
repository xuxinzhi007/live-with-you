const PUPPET_CONFIG_URL = "assets/characters/wenbebi/puppet.json";

export class PuppetPetRenderer {
  constructor(element, definition) {
    this.element = element;
    this.actor = element.querySelector(".pet-actor");
    this.picture = this.actor?.querySelector("picture");
    this.definition = definition;
    this.rig = null;
    this.resizeObserver = null;
    this.state = "idle";
    this.destroyed = false;
    this.load();
  }

  async load() {
    try {
      const response = await fetch(PUPPET_CONFIG_URL, { cache: "no-cache" });
      if (!response.ok) return;
      const config = await response.json();
      if (this.destroyed || !Array.isArray(config.parts) || !config.parts.some((part) => part.asset)) return;
      const parts = config.parts.filter((part) => part.asset);
      const rig = document.createElement("div");
      rig.className = "puppet-rig";
      const canvas = config.canvas || { width: 512, height: 720 };
      rig.style.setProperty("--puppet-width", `${Number(canvas.width) || 512}px`);
      rig.style.setProperty("--puppet-height", `${Number(canvas.height) || 720}px`);
      rig.dataset.state = this.state;
      for (const part of parts) {
        const image = document.createElement("img");
        image.className = `puppet-part puppet-part--${part.id}`;
        image.alt = "";
        image.draggable = false;
        image.decoding = "async";
        image.src = part.asset;
        image.style.zIndex = String(Number(part.z) || 0);
        image.style.width = `${Number(part.width) || Number(canvas.width) || 512}px`;
        image.style.height = `${Number(part.height) || Number(canvas.height) || 720}px`;
        image.style.transformOrigin = `${Number(part.pivotX) || 50}% ${Number(part.pivotY) || 50}%`;
        image.style.setProperty("--part-x", `${Number(part.x) || 0}px`);
        image.style.setProperty("--part-y", `${Number(part.y) || 0}px`);
        image.style.setProperty("--part-scale", String(Number(part.scale) || 1));
        image.style.setProperty("--part-rotation", `${Number(part.rotation) || 0}deg`);
        rig.append(image);
      }
      this.actor.append(rig);
      this.actor.dataset.renderer = "puppet";
      this.rig = rig;
      const updateScale = () => {
        const width = Number(canvas.width) || 512;
        const height = Number(canvas.height) || 720;
        const scale = Math.min(this.actor.clientWidth / width, this.actor.clientHeight / height);
        rig.style.setProperty("--puppet-scale", String(scale || 1));
      };
      updateScale();
      if (typeof ResizeObserver !== "undefined") {
        this.resizeObserver = new ResizeObserver(updateScale);
        this.resizeObserver.observe(this.actor);
      }
      if (this.picture) this.picture.hidden = true;
    } catch {
      // A missing puppet config is an expected fallback during development.
    }
  }

  setAnimation(state) {
    this.state = state;
    if (this.rig) this.rig.dataset.state = state;
  }

  destroy() {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.rig?.remove();
    if (this.picture) this.picture.hidden = false;
  }
}
