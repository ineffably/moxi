import PIXI from "pixi.js";

export class Scene extends PIXI.Container {
  renderer: PIXI.Renderer<HTMLCanvasElement>;

  constructor(renderer: PIXI.Renderer<HTMLCanvasElement>) {
    super();
    this.renderer = renderer;
  }

  init() {
    this.children.forEach((child: any) => {
      if(child.init) {
        child.init(this.renderer);
      }
    })
  }


  update(deltaTime: number) {
    this.children.forEach((child: any) => {
      if(child.update) {
        child.update(deltaTime);
      }
    })
  }

  draw(deltaTime: number) {
    this.children.forEach((child: any) => {
      if(child.draw) {
        child.draw(deltaTime);
      }
    })
    this.renderer.render(this);
  }
}