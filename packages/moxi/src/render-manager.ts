import PIXI from 'pixi.js';

export class RenderManager {
  static getRenderer: (options: Partial<PIXI.AutoDetectOptions>) => Promise<PIXI.Renderer>;

  static create: (
      htmlRoot: HTMLElement, 
      options: Partial<PIXI.AutoDetectOptions>) => Promise<RenderManager>;

  htmlRoot: HTMLElement;
  renderer: PIXI.Renderer;
  fitToWindow = false;;

  constructor(htmlRoot: HTMLElement, renderer: PIXI.Renderer) {
    this.htmlRoot = htmlRoot;
    this.renderer = renderer;

    htmlRoot.appendChild(this.renderer.canvas);
    window.addEventListener('resize', () => this.onResize());

    this.onResize();
  }

  render(stage: PIXI.Container) {
    this.renderer.render(stage);
  }

  onResize = () => {
    const { renderer, htmlRoot: root } = this;
    const canvas = renderer.canvas;
    const h = root.clientHeight;
    const w = root.clientWidth;
    
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = w;
    canvas.height = h;
    renderer.resize(w, h);

    if (this.fitToWindow) {
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      canvas.width = w;
      canvas.height = h;
      renderer.resize(w, h);
    }

  }
}

RenderManager.getRenderer = async (options: Partial<PIXI.AutoDetectOptions>) => (
  await PIXI.autoDetectRenderer(options)
);

RenderManager.create = async (htmlRoot: HTMLElement, options: Partial<PIXI.AutoDetectOptions>) => (
  new RenderManager(htmlRoot, await RenderManager.getRenderer(options))
);
