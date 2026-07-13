import { forwardRef, memo, useEffect, useImperativeHandle, useRef } from 'react';
import CodeMirror from 'codemirror';
import type { Editor as CodeMirrorEditor } from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/stex/stex';
import 'codemirror/theme/material.css';
import { useTheme } from 'antd-style';

interface LatexCodeMirrorProps {
  value: string;
  onChange: (value: string) => void;
}

// Imperative handle exposed to parent (toolbar) for inserting LaTeX commands at the cursor.
export interface LatexCodeMirrorHandle {
  insertAtCursor: (text: string) => void;
  focus: () => void;
}

function LatexCodeMirrorComp(
  props: LatexCodeMirrorProps,
  ref: React.Ref<LatexCodeMirrorHandle>,
): React.ReactElement {
  const { value, onChange } = props;
  const theme = useTheme();
  const isDark = theme.appearance === 'dark';
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<CodeMirrorEditor | null>(null);

  // Keep latest onChange without re-running the init effect.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Expose imperative API to parent
  useImperativeHandle(
    ref,
    (): LatexCodeMirrorHandle => ({
      insertAtCursor: (text: string) => {
        const cm = editorRef.current;
        if (!cm) return;
        const cursor = cm.getCursor();
        cm.replaceRange(text, cursor, undefined, '+input');
        cm.focus();
      },
      focus: () => {
        editorRef.current?.focus();
      },
    }),
    [],
  );

  // Initialize CodeMirror once
  useEffect(() => {
    if (!hostRef.current) return;

    const editor = CodeMirror(hostRef.current, {
      value,
      mode: 'stex',
      theme: isDark ? 'material' : 'default',
      lineNumbers: true,
      lineWrapping: true,
      indentUnit: 2,
      tabSize: 2,
      indentWithTabs: false,
    });

    editorRef.current = editor;

    editor.on('change', () => {
      onChangeRef.current(editor.getValue());
    });

    return () => {
      // CodeMirror 5 has no public destroy method; removing the host children
      // detaches its DOM and lets GC reclaim the instance.
      if (hostRef.current) {
        hostRef.current.innerHTML = '';
      }
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes into the editor (avoid clobbering when value matches)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.getValue() !== value) {
      editor.setValue(value);
      // CodeMirror 5 needs refresh after setValue when content loads asynchronously,
      // otherwise the editor may render blank until the next interaction.
      requestAnimationFrame(() => editor.refresh());
    }
  }, [value]);

  // Switch CodeMirror theme when app appearance changes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.setOption('theme', isDark ? 'material' : 'default');
  }, [isDark]);

  // Refresh after mount so CodeMirror measures the correct visible size
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const raf = requestAnimationFrame(() => editor.refresh());
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={hostRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden' }}
      className="latex-codemirror-host"
    />
  );
}

export const LatexCodeMirror = memo(forwardRef(LatexCodeMirrorComp));
