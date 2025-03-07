import PIXI from 'pixi.js';
import { Asset } from './types';
export declare class AssetLoader {
    PIXIAssets: PIXI.AssetsClass;
    textures: any[];
    loadAssets: (assets: Asset[]) => Promise<this>;
}
