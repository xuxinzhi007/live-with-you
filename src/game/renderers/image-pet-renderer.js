export class ImagePetRenderer {
  constructor(element, definition) {
    this.element = element;
    this.sprites = definition.sprites;
    this.spriteName = "";
    this.image = element.querySelector("img");
    this.source = element.querySelector("source");
  }

  setAnimation(state) {
    const name = this.sprites[state] || this.sprites.idle;
    if (this.spriteName === name) return;
    this.spriteName = name;
    if (this.source) this.source.srcset = `assets/${name}.webp`;
    if (this.image) this.image.src = `assets/${name}.png`;
  }

  destroy() {}
}
