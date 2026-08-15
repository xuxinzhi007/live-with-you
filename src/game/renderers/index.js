import { PuppetPetRenderer } from "./puppet-pet-renderer.js";

export function createPetRenderer(element, definition) {
  // Puppet mode is opt-in through a static config file; image mode remains the fallback.
  return new PuppetPetRenderer(element, definition);
}
