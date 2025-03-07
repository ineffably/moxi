import PIXI from 'pixi.js';
import { Scene } from './scene';
export declare class Engine {
    ticker: PIXI.Ticker;
    root: Scene;
    constructor(stage?: Scene);
    start(): this;
    stop(): this;
    gameLoop: (deltaTime: any) => void;
    loadStage(stage: Scene): this;
}
