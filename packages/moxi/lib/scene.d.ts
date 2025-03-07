import PIXI from "pixi.js";
export declare class Scene extends PIXI.Container {
    renderer: PIXI.Renderer<HTMLCanvasElement>;
    constructor(renderer: PIXI.Renderer<HTMLCanvasElement>);
    init(): void;
    update(deltaTime: number): void;
    draw(deltaTime: number): void;
}
