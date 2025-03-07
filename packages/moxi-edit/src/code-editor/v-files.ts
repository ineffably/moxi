
export const vFiles = {
  'pixicode.ts': {
    name: 'pixicode.ts',
    language: 'typescript',
    value: `
    import PIXI from 'pixi.js'

    console.log(PIXI.VERSION);
`
  },


  'simple.ts': {
    name: 'simple.ts',
    language: 'typescript',
    value: `
console.log('Hello World');
`
  },
  'examplepixi.ts': {
    name: 'examplepixi.ts',
    language: 'typescript',
    value: `

    import { Application, Assets, Container, Sprite } from 'pixi.js';

    (async () =>
    {
        // Create a new application
        const app = new Application();
    
        // Initialize the application
        await app.init({ background: '#1099bb', resizeTo: window });
    
        // Append the application canvas to the document body
        document.body.appendChild(app.canvas);
    
        // Create and add a container to the stage
        const container = new Container();
    
        app.stage.addChild(container);
    
        // Load the bunny texture
        const texture = await Assets.load('https://pixijs.com/assets/bunny.png');
    
        // Create a 5x5 grid of bunnies in the container
        for (let i = 0; i < 25; i++)
        {
            const bunny = new Sprite(texture);
    
            bunny.x = (i % 5) * 40;
            bunny.y = Math.floor(i / 5) * 40;
            container.addChild(bunny);
        }
    
        // Move the container to the center
        container.x = app.screen.width / 2;
        container.y = app.screen.height / 2;
    
        // Center the bunny sprites in local container coordinates
        container.pivot.x = container.width / 2;
        container.pivot.y = container.height / 2;
    
        // Listen for animate update
        app.ticker.add((time) =>
        {
            // Continuously rotate the container!
            // * use delta to create frame-independent transform *
            container.rotation -= 0.01 * time.deltaTime;
        });
    })();

`
  },
  'example1.ts': {
    name: 'example1.ts',
    language: 'typescript',
    value: `
import { Engine, RenderManager, SpriteEntity, Scene, AssetLoader } from "moxi";

const root = document.getElementById('example');
const renderMan = await RenderManager.create(root, { width: 1280, height: 720 });
const { renderer } = renderMan;
renderer.background.color = 'cornflowerblue';

const world = new Scene();

// // we can either call loadWorld or we can pass the world into the engine constructor.
const engine = new Engine(world);

const assetList = [
  { src: './assets/character_robot_idle.png', alias: 'character' }
];

const { PIXIAssets, loadAssets } = new AssetLoader();
await loadAssets(assetList);

const characterTexture = PIXIAssets.get('character');
const character = new Character(characterTexture);
world.addChild(character);

engine.start();
`,
  },  
}