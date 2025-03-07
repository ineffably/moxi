import PIXI from "pixi.js";

export abstract class Entity extends PIXI.Container {

  init(...args) {}

  update = (deltaTime: number) => {
    this.children.forEach((child: any) => {
      if(child.update) {
        child.update(deltaTime);
      }
    })
  }
}

export abstract class SpriteEntity extends PIXI.Sprite {
  constructor(texture) {
    super(texture);
  }

  init(...args) {}
  
  update(deltaTime: number) {
    this.children.forEach((child: any) => {
      if(child.update) {
        child.update(deltaTime);
      }
    })
  }
}


