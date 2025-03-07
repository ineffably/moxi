import PIXI from 'pixi.js';
import FontFaceObserver from 'fontfaceobserver';

export const loadFonts = async () => {
  // note that this references the font-face specified in the HTML style section
  // <style>
  // @font-face {
  //   font-family: 'kenfuture-thin';
  //   src: url('./assets/fonts/kenvector_future_thin.ttf');
  // }
  // </style>

  // using fontfaceobserver allows us ensure the font is loaded before using configuration for bitmap fonts.
  const fontKenfutureThin = new FontFaceObserver('kenfuture-thin');
  var bitmapFontInstallOptions = {
    name: 'kenfuture-thin',
    chars: [['a', 'z'], ['0', '9'], ['A', 'Z'], ' \\|/.-^%$&*()!?+'],
    style: {
      fontFamily: 'kenfuture-thin',
      fontSize: 24,
      strokeThickness: 2,
      fill: 'white',
    } as PIXI.TextStyleOptions
  } as PIXI.BitmapFontInstallOptions;
  
  return new Promise((resolve, reject) => {
    // once loaded, we can resolve the installer
    fontKenfutureThin.load().then(() => {
      // PIXI.BitmapFont.from will create a bitmap font from a font-face and TextStyle configuration
      // Using a Bitmapfont allows for better performance when rapidly changing rendered text.

      // The BitmapFont.install method will install the font into the PIXI.BitmapFont object
      const bitmapGameFont = PIXI.BitmapFont.install(bitmapFontInstallOptions);

      resolve({ bitmapGameFont });
    });
  });
}

// {
//   /** the name of the font, this will be the name you use in the fontFamily of text style to access this font */
//   name?: string;
//   /**
//    * Characters included in the font set. You can also use ranges.
//    * For example, `[['a', 'z'], ['A', 'Z'], "!@#$%^&*()~{}[] "]`.
//    * Don't forget to include spaces ' ' in your character set!
//    * @default BitmapFont.ALPHANUMERIC
//    */
//   chars?: string | (string | string[])[];
//   /**
//    * Render resolution for glyphs.
//    * @default 1
//    */
//   resolution?: number;
//   /**
//    * Padding between glyphs on texture atlas. Lower values could mean more visual artifacts
//    * and bleeding from other glyphs, larger values increase the space required on the texture.
//    * @default 4
//    */
//   padding?: number;
//   /**
//    * Skip generation of kerning information for the BitmapFont.
//    * If true, this could potentially increase the performance, but may impact the rendered text appearance.
//    * @default false
//    */
//   skipKerning?: boolean;
//   /** Style options to render with BitmapFont. */
//   style?: TextStyle | TextStyleOptions;
// }