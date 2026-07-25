import { Bold, Italic, Link2, List, ListOrdered, RemoveFormatting, Underline } from 'lucide-react';
import { type ClipboardEvent, useEffect, useRef } from 'react';
import { sanitizeProjectHtml } from './ProjectRichText';

type RichTextEditorProps = {
  className?: string;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
};

export function RichTextEditor({ className, label, onChange, placeholder, value }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  function emitChange() {
    onChange(sanitizeProjectHtml(editorRef.current?.innerHTML ?? ''));
  }

  function runCommand(command: string, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    emitChange();
  }

  function addLink() {
    const url = window.prompt('Paste link URL');
    if (!url) return;
    runCommand('createLink', url.trim());
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const html = event.clipboardData.getData('text/html');
    const text = event.clipboardData.getData('text/plain');
    document.execCommand('insertHTML', false, sanitizeProjectHtml(html || text));
    emitChange();
  }

  return (
    <div className={['admin-project-rte career-rte', className].filter(Boolean).join(' ')}>
      <span>{label}</span>
      <div className="admin-project-rte__box">
        <div className="admin-project-rte__toolbar" aria-label={`${label} formatting tools`}>
          <button aria-label="Bold" onClick={() => runCommand('bold')} title="Bold" type="button"><Bold size={15} /></button>
          <button aria-label="Italic" onClick={() => runCommand('italic')} title="Italic" type="button"><Italic size={15} /></button>
          <button aria-label="Underline" onClick={() => runCommand('underline')} title="Underline" type="button"><Underline size={15} /></button>
          <button aria-label="Bullet list" onClick={() => runCommand('insertUnorderedList')} title="Bullet list" type="button"><List size={15} /></button>
          <button aria-label="Numbered list" onClick={() => runCommand('insertOrderedList')} title="Numbered list" type="button"><ListOrdered size={15} /></button>
          <button aria-label="Add link" onClick={addLink} title="Add link" type="button"><Link2 size={15} /></button>
          <button aria-label="Clear formatting" onClick={() => runCommand('removeFormat')} title="Clear formatting" type="button"><RemoveFormatting size={15} /></button>
        </div>
        <div
          className="admin-project-rte__editor"
          contentEditable
          data-placeholder={placeholder}
          onBlur={emitChange}
          onInput={emitChange}
          onPaste={handlePaste}
          ref={editorRef}
          role="textbox"
          suppressContentEditableWarning
        />
      </div>
    </div>
  );
}
