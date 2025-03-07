import React from 'react';
import ReactDOM from 'react-dom/client';
import { ExamplesRoot } from './examples-root';

const container = document.getElementById('examples-ui');
const element = React.createElement(ExamplesRoot);
ReactDOM.createRoot(container).render(element);
