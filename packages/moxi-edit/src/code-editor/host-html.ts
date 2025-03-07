
export interface getHostHtmlArgs {
  code: string;
}

export const getHostHtml = ({ code }) => {
  return (`
<html>
  <head>
  <script type="module">
  // window.onerror = function(message, source, lineno, colno, error) { 
  //   console.log('==IFRAME ERROR==', [message, source, lineno, colno, error]);
  //   return true;
  // };
  </script>
  <link href="iframe-html.css" rel="stylesheet">
  </head>
  <body>
    <div id="app"></div>
    <script type="module">
      window.addLink = (url => {
        const link = document.createElement('link');
        link.href = url;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      });
      window.run = (${code || '() => {};'})
    </script>
  </body>
</html>
`
  )
}
