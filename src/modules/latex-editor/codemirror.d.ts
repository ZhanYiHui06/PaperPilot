// Minimal type declarations for CodeMirror 5 (the package ships without .d.ts files).
// Only the surface area used by the latex-editor module is declared here.

declare module 'codemirror' {
  export interface EditorSelection {
    anchor: { line: number; ch: number };
    head: { line: number; ch: number };
  }

  export interface EditorConfiguration {
    value?: string;
    mode?: string | object;
    theme?: string;
    lineNumbers?: boolean;
    lineWrapping?: boolean;
    indentUnit?: number;
    tabSize?: number;
    indentWithTabs?: boolean;
    extraKeys?: Record<string, (editor: Editor) => void>;
    [key: string]: unknown;
  }

  export interface EditorChangeObject {
    from: { line: number; ch: number };
    to: { line: number; ch: number };
    text: string;
    removed?: string;
    origin?: string;
  }

  export interface EditorHistory {
    undo(): void;
    redo(): void;
    clearHistory(): void;
  }

  export interface Editor extends EditorHistory {
    getValue(): string;
    setValue(content: string): void;
    setOption(key: string, value: unknown): void;
    getCursor(): { line: number; ch: number };
    setCursor(pos: { line: number; ch: number }): void;
    replaceRange(
      replacement: string,
      from: { line: number; ch: number },
      to?: { line: number; ch: number },
      origin?: string,
    ): void;
    getSelection(): string;
    replaceSelection(replacement: string, select?: string): void;
    on(event: string, handler: (...args: unknown[]) => void): void;
    off(event: string, handler: (...args: unknown[]) => void): void;
    refresh(): void;
    focus(): void;
    toTextArea(): void;
  }

  // The default export is a callable factory.
  const CodeMirror: {
    (host: HTMLElement, options?: EditorConfiguration): Editor;
    fromTextArea(host: HTMLTextAreaElement, options?: EditorConfiguration): Editor;
    defineMode: (name: string, modeFactory: () => unknown) => void;
  };

  export default CodeMirror;
}
