export function CreateMonacoConfig() {
  (window as any).MonacoEnvironment = {
    getWorker(_: string, label: string) {
      switch (label) {
        case 'json':
          return new Worker(
            new URL('../node_modules/monaco-editor/esm/vs/language/json/json.worker.js', import.meta.url),
            {
              type: 'module'
            }
          );
        case 'css':
          return new Worker(
            new URL('../node_modules/monaco-editor/esm/vs/language/css/css.worker.js', import.meta.url),
            {
              type: 'module'
            }
          );
        case 'html':
          return new Worker(
            new URL('../node_modules/monaco-editor/esm/vs/language/html/html.worker.js', import.meta.url),
            {
              type: 'module'
            }
          );
        case 'typescript':
        case 'javascript':
          return new Worker(
            new URL('../node_modules/monaco-editor/esm/vs/language/typescript/ts.worker.js', import.meta.url),
            {
              type: 'module'
            }
          );
        default:
          return new Worker(new URL('../node_modules/monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url), {
            type: 'module'
          });
      }
    }
  };
}
