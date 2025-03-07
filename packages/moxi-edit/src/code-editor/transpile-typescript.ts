import { transpile } from 'typescript';

export const transpileTypescript = (code: string, tsConfig = {}) => {
  let finalAttempt = null;
  try {
    const defaultTsConfig = {
      "allowNonTsExtensions": true,
      "target": 99,
      "module": 1,
      "moduleResolution": 1,
      "resolveJsonModule": true,
      "allowSyntheticDefaultImports": true,
      "esModuleInterop": true
    }
    const finalPass = transpile(code, defaultTsConfig);

    finalAttempt = finalPass;

    const iframeValue = `
    ({require, renderId, exports} = {}) => {
    try{
      ${finalPass}
    }catch(err){
      console.error(err);
      window.postMessage({err, renderId}, '*');
      throw(err);
    }}
    `;

    return {
      error: null,
      iframeCode: iframeValue,
      sourceCode: finalPass,
    }
  }
  catch (e) {
    // console.log(e);
    return {
      error: e,
      iframeCode: finalAttempt,
      sourceCode: finalAttempt,
    }
  }
}