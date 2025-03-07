import PIXI from 'pixi.js';
import { Scene } from './scene';

export class Engine {
  ticker: PIXI.Ticker;
  root: Scene;
  
  constructor(stage: Scene = null) {
    this.root = stage;
    const ticker = PIXI.Ticker.shared;
    ticker.autoStart = false;
    ticker.add(this.gameLoop);
    this.ticker = ticker;
  }

  start() {
    this.ticker.start();
    return this;
  }

  stop() {
    this.ticker.stop();
    return this;
  }

  gameLoop = (deltaTime) => {
    if(this.root){
      this.root.update(deltaTime);
      this.root.draw(deltaTime);
    }
  }

  loadStage(stage: Scene) {
    this.root = stage;
    return this;
  }
}
