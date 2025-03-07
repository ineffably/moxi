import PIXI from 'pixi.js';
import { Asset } from './types';

export class AssetLoader {
  PIXIAssets: PIXI.AssetsClass = PIXI.Assets;
  textures: any[] = [];

  loadAssets = async (assets: Asset[]) => {
    const { PIXIAssets } = this;

    for (let i = 0; i < assets.length; i++) {
      const { src, alias } = assets[i];
      
      if (alias) {
        if (!PIXIAssets.cache.has(alias)) {
          const texture = await PIXIAssets.load({ alias, src });
          this.textures.push(texture);
        }
      }
      else {
        const texture = await PIXIAssets.load(src);
        this.textures.push(texture);
      }
    }
    return this;
  }
}