import React, { useState } from 'react';
import { marked } from 'marked';

interface MarkdownRendererProps {
  content: string;
}

interface CodeBlockProps {
  language: string;
  filename?: string;
  code: string;
}

function CodeBlock({ language, filename, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayTitle = filename || language || 'code';

  return (
    <div className="my-3 rounded-xl overflow-hidden bg-[#0d0d0d] border border-white/10 shadow-sm font-mono-code">
      <div className="px-4 py-2 bg-[#1a1a1a] flex items-center justify-between text-[#b4b4b4] text-xs">
        <span className="font-medium text-[#d4d4d4] lowercase">{displayTitle}</span>
        <button
          onClick={handleCopy}
          type="button"
          className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer text-xs"
          title="Copy code"
        >
          <span className="material-symbols-outlined text-[15px]">
            {copied ? 'check' : 'content_copy'}
          </span>
          <span>{copied ? 'Copied!' : 'Copy code'}</span>
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-[13px] leading-relaxed text-[#ececec]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // Parse code blocks with regex or marked tokens for optimal interactive React components
  // We can segment the text into code blocks and markdown segments
  const segments: React.ReactNode[] = [];
  const codeBlockRegex = /```([a-zA-Z0-9_\-\.\/]*)\n([\s\S]*?)```/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Non-code markdown before the match
    if (match.index > lastIndex) {
      const textChunk = content.substring(lastIndex, match.index);
      segments.push(
        <div
          key={`text-${lastIndex}`}
          className="markdown-prose leading-relaxed space-y-2"
          dangerouslySetInnerHTML={{
            __html: marked.parse(textChunk, { async: false, breaks: true }) as string,
          }}
        />
      );
    }

    // Code block
    const meta = match[1] || '';
    const code = match[2];
    let language = meta.trim();
    let filename: string | undefined;

    if (language.includes(':')) {
      const parts = language.split(':');
      language = parts[0];
      filename = parts[1];
    } else if (language.includes('/') || language.includes('.')) {
      filename = language;
      language = language.split('.').pop() || '';
    }

    segments.push(
      <CodeBlock
        key={`code-${match.index}`}
        language={language || 'typescript'}
        filename={filename}
        code={code.trimEnd()}
      />
    );

    lastIndex = match.index + match[0].length;
  }

  // Trailing markdown
  if (lastIndex < content.length) {
    const textChunk = content.substring(lastIndex);
    segments.push(
      <div
        key={`text-${lastIndex}`}
        className="markdown-prose leading-relaxed space-y-2"
        dangerouslySetInnerHTML={{
          __html: marked.parse(textChunk, { async: false, breaks: true }) as string,
        }}
      />
    );
  }

  return (
    <div className="space-y-2 text-[14px] leading-relaxed text-[#dae2fd] overflow-hidden">
      {segments.length > 0 ? (
        segments
      ) : (
        <div
          className="markdown-prose leading-relaxed space-y-2"
          dangerouslySetInnerHTML={{
            __html: marked.parse(content, { async: false, breaks: true }) as string,
          }}
        />
      )}
    </div>
  );
};
