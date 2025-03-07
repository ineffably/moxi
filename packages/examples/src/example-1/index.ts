import { Engine, RenderManager, SpriteEntity, Scene, AssetLoader } from "moxi";

class Character extends SpriteEntity {
  update(deltaTime: number) {
    this.rotation += deltaTime * 0.1;
  }

  init(renderer) {
    this.name = 'roboto';
    const { width, height } = renderer.view;
    this.anchor.set(0.5);
    this.x = width / 2;
    this.y = height / 2;
  }
}

export const Example01 = async () => {
  const root = document.getElementById('example');
  const renderMan = await RenderManager.create(root, { width: 1280, height: 720 });
  const { renderer } = renderMan;
  renderer.background.color = 'cornflowerblue';

  const scene = new Scene(renderer);

  // // we can either call loadWorld or we can pass the world into the engine constructor.
  const engine = new Engine(scene);

  const assetList = [
    { src: './assets/character_robot_idle.png', alias: 'character' }
  ];

  const { PIXIAssets, loadAssets } = new AssetLoader();
  await loadAssets(assetList);
  
  const characterTexture = PIXIAssets.get('character');
  const character = new Character(characterTexture);
  scene.addChild(character);

  scene.init();
  
  engine.start();

  

}