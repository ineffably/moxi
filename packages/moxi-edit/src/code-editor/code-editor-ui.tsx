import { useEffect, useState } from "react";
import Editor, { loader } from '@monaco-editor/react';
import { vFiles } from './v-files';
import monaco from 'monaco-editor';
import React from 'react';
import ReactDOM from 'react-dom/client';
import PIXI from 'pixi.js';
import moxi from 'moxi';

// @ts-ignore
import sdkTypeDef from '!raw-loader!../../../moxi/lib/index.d.ts';
// @ts-ignore
import pixidef from '!raw-loader!../../../../node_modules/pixi.js/dist/pixi.js.d.ts';

import { getHostHtml } from "./host-html";
import { transpileTypescript } from "./transpile-typescript";

export const requireIntercept = (userRequireMap = {}, iframeRef: HTMLIFrameElement) => (moduleName) => {
  console.log('==> requireIntercept', moduleName);
  if (moduleName.endsWith('.css')) {
    // css module loading is lame, loading all in main.css with webpack.
    // can't load from node_modules because tilde references ~@ux...
    // need some fancy loader stuff I'm not spending time on atm
    return '';
  }
  const reference = (({ ...requireMap, ...userRequireMap })[moduleName]);
  if (!reference) {
    console.error(`module for ${moduleName} was not found`)
    return null
  }
  // debugging why charts isn't loading...
  if (moduleName.toLowerCase() === '@ux/charts') {
    console.log(reference);
  }
  return reference;
}

const requireMap = {
  'pixi.js': PIXI,
  'moxi': moxi,
  'React': React,
  'ReactDOM': ReactDOM,
}

const { typescript } = monaco.languages;

loader.config({ monaco });
const defaults = typescript.typescriptDefaults;
defaults.addExtraLib(`declare module 'moxi' { ${sdkTypeDef} }`, 'file:///node_modules/moxi/lib/index.d.ts');
defaults.addExtraLib(`declare module 'pixi.js' { ${pixidef} }`, 'file:///node_modules/pixi.js/dist/pixi.js.d.ts');
defaults.addExtraLib(`declare module 'moxi' { ${sdkTypeDef} }`, 'file:///node_modules/moxi/lib/index.d.ts');
defaults.addExtraLib(`declare module 'pixi.js' { ${pixidef} }`, 'file:///node_modules/pixi.js/dist/pixi.js.d.ts');

const compilerOptions = defaults.getCompilerOptions();
compilerOptions.module = typescript.ModuleKind.ESNext;
compilerOptions.moduleResolution = typescript.ModuleResolutionKind.Classic;
compilerOptions.resolveJsonModule = true;
compilerOptions.allowSyntheticDefaultImports = true;
compilerOptions.esModuleInterop = true;

defaults.setCompilerOptions(compilerOptions);

export const CodeEditorUI = () => {
  const vfile = vFiles['examplepixi.ts'];
  const [codeText, setCodeText] = useState(vfile.value);
  const [iframeRef, setIframeRef] = useState(null as HTMLIFrameElement);
  const [jsCode, setJsCode] = useState('');
  const [lastError, setLastError] = useState(null as any);
  const [iframeCode, setIframeCode] = useState('');
  const [renderId, setRenderId] = useState(1);
  const [sourceCode, setSourceCode] = useState('');

  const requireMapping = requireIntercept(requireMap, iframeRef);

  useEffect(() => {
    const { iframeCode, sourceCode, error } = transpileTypescript(codeText);
    console.log('error', error)
    if (error) {
      // console.log(error);
      setLastError({ error });
    }
    else {
      setLastError({})
      setSourceCode(sourceCode);
      setIframeCode(iframeCode);
      setRenderId(renderId + 1);
    }
  }, [codeText])

  useEffect(() => {
    if (iframeRef) {
      window.setTimeout(() => {
        try {
          const { run } = (iframeRef?.contentWindow?.window as any) || {};

          if (run) {
            console.log('running: renderId:', renderId)
            console.log(run)

            run({ require: requireMapping, renderId, exports: {} })
          }
        }
        catch (e) {
          // setLastError({message, source, lineno, colno, error, targetLines})
          setLastError({ name: e.name, message: e.message })
          // console.log('contentWindow', e)
        }
      }, 350);
    }
  }, [iframeCode])


  return (
    <div style={{ display: 'flex', flexDirection: 'row' }}>
      <div style={{ height: '90vh', width: '50vw' }}>
        <Editor
          height='90vh'
          theme="vs-dark"
          language={vfile.language}
          value={codeText}
          onChange={(value) => setCodeText(value)}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', height: '90vh', width: '50vw' }}>
        <div id="render-target">
          <iframe style={{ height: '90vh', width: '50vw' }} ref={r => { setIframeRef(r) }} srcDoc={getHostHtml({ code: iframeCode })} />
        </div>
        <div id="logs"></div>
      </div>
    </div>
  )
}
