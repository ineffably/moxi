const webpack = require('webpack');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const outDir = 'lib';

module.exports = (env, argv) => {
  const { mode = 'development' } = argv;
  const devtool = mode === 'production' ? false : 'inline-source-map';

  return ({
    mode,
    devtool,
    entry: './src/index.ts',
    output: {
      path: path.join(__dirname, outDir),
      filename: `index.js`,
      library: { name: 'moxi-edit', type: 'umd' }
    },
    devServer: {
      port: 8888,
      static: {
        directory: path.join(__dirname, './'),
        publicPath: '/'
      },
    },
    module: {
      noParse: [require.resolve("typescript/lib/typescript.js")],
      rules: [
        {
          test: /\.tsx?|.ts?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/i,
          use: ['style-loader', 'css-loader'],
        }
      ],
    },
    resolve: {
      plugins: [new TsconfigPathsPlugin({/* options: see below */})],
      extensions: ['.tsx', '.ts', '.js']
    },
    plugins: [
      new MonacoWebpackPlugin(),      
      new HtmlWebpackPlugin({
        template: path.join(__dirname, './index.html')
      }),
    ]
  })
}