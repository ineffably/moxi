import React from 'react';
import ReactDOM from 'react-dom/client';
import { EditorRoot } from './editor-root';

(window as any).appLoaded = true;

const container = document.getElementById('editor-ui');
if(container){
  const element = React.createElement(EditorRoot);
  ReactDOM.createRoot(container).render(element);
}

export { EditorRoot };
