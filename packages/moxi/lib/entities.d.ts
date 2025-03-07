import PIXI from "pixi.js";
export declare abstract class Entity extends PIXI.Container {
    init(...args: any[]): void;
    update: (deltaTime: number) => void;
}
export declare abstract class SpriteEntity extends PIXI.Sprite {
    constructor(texture: any);
    init(...args: any[]): void;
    update(deltaTime: number): void;
}
