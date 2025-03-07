import PIXI from 'pixi.js';
export declare class RenderManager {
    static getRenderer: (options: Partial<PIXI.AutoDetectOptions>) => Promise<PIXI.Renderer>;
    static create: (htmlRoot: HTMLElement, options: Partial<PIXI.AutoDetectOptions>) => Promise<RenderManager>;
    htmlRoot: HTMLElement;
    renderer: PIXI.Renderer;
    fitToWindow: boolean;
    constructor(htmlRoot: HTMLElement, renderer: PIXI.Renderer);
    render(stage: PIXI.Container): void;
    onResize: () => void;
}
