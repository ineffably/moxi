const webpack = require('webpack');
const path = require('path');
const outDir = 'lib';


module.exports = (env, argv) => {
  const { mode = 'development' } = argv;
  const devtool = mode === 'production' ? false : 'inline-source-map';
  
  return {
    mode,
    devtool,
    entry: './src/index.ts',
    output: {
      path: path.join(__dirname, outDir),
      filename: `index.js`,
      library: { name: 'moxi', type: 'umd' }
    },
    externals: {
      // 'RAPIER': '@dimforge/rapier2d',
      // '@dimforge/rapier2d': 'RAPIER'
      'PIXI': 'pixi.js'
    },
    module: {
      rules: [
        {
          test: /\.tsx?|.ts?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/i,
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js']
    }
  }
}
