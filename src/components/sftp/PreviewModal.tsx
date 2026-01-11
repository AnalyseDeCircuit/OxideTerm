import { useMemo } from 'react';
import {
  XMarkIcon,
  DocumentIcon,
  PhotoIcon,
  CodeBracketIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { useSftpStore } from '../../stores/sftpStore';
import type { PreviewContent } from '../../types/sftp';
import { formatFileSize } from '../../types/sftp';

export function PreviewModal() {
  const { isPreviewOpen, previewContent, previewPath, closePreview } =
    useSftpStore();

  const fileName = useMemo(() => {
    if (!previewPath) return '';
    return previewPath.split('/').pop() || previewPath;
  }, [previewPath]);

  if (!isPreviewOpen || !previewContent) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-gray-900 rounded-lg shadow-xl max-w-4xl max-h-[90vh] w-full mx-4 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800">
          <div className="flex items-center gap-2 min-w-0">
            <PreviewIcon content={previewContent} />
            <span className="font-medium truncate">{fileName}</span>
          </div>
          <button
            onClick={closePreview}
            className="p-1 hover:bg-gray-700 rounded"
            title="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <PreviewRenderer content={previewContent} fileName={fileName} />
        </div>
      </div>
    </div>
  );
}

function PreviewIcon({ content }: { content: PreviewContent }) {
  if ('Text' in content) {
    const { mime_type } = content.Text;
    if (mime_type?.includes('json') || mime_type?.includes('javascript')) {
      return <CodeBracketIcon className="w-5 h-5 text-blue-400" />;
    }
    return <DocumentTextIcon className="w-5 h-5 text-gray-400" />;
  }

  if ('Base64' in content) {
    return <PhotoIcon className="w-5 h-5 text-green-400" />;
  }

  return <DocumentIcon className="w-5 h-5 text-gray-400" />;
}

interface PreviewRendererProps {
  content: PreviewContent;
  fileName: string;
}

function PreviewRenderer({ content, fileName }: PreviewRendererProps) {
  // Text content
  if ('Text' in content) {
    const { data, mime_type } = content.Text;
    const language = getLanguageFromMime(mime_type || '', fileName);

    return (
      <div className="relative">
        <div className="absolute top-2 right-2 px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">
          {mime_type || 'text/plain'}
        </div>
        <pre className="p-4 text-sm font-mono overflow-auto whitespace-pre-wrap break-words text-gray-200">
          <code className={`language-${language}`}>{data}</code>
        </pre>
      </div>
    );
  }

  // Base64 image
  if ('Base64' in content) {
    const { data, mime_type } = content.Base64;
    const dataUrl = `data:${mime_type || 'image/png'};base64,${data}`;

    return (
      <div className="flex items-center justify-center p-4 bg-[#1a1a2e]">
        <img
          src={dataUrl}
          alt={fileName}
          className="max-w-full max-h-[70vh] object-contain"
          style={{ imageRendering: 'auto' }}
        />
      </div>
    );
  }

  // Too large
  if ('TooLarge' in content) {
    const { size, max_size } = content.TooLarge;

    return (
      <div className="flex flex-col items-center justify-center p-8 text-gray-400">
        <DocumentIcon className="w-16 h-16 mb-4" />
        <p className="text-lg font-medium mb-2">File too large to preview</p>
        <p className="text-sm">
          File size: {formatFileSize(size)} (max: {formatFileSize(max_size)})
        </p>
        <p className="text-sm mt-4">Download the file to view its contents.</p>
      </div>
    );
  }

  // Unsupported
  if ('Unsupported' in content) {
    const { mime_type } = content.Unsupported;

    return (
      <div className="flex flex-col items-center justify-center p-8 text-gray-400">
        <DocumentIcon className="w-16 h-16 mb-4" />
        <p className="text-lg font-medium mb-2">Preview not available</p>
        <p className="text-sm">
          File type: {mime_type || 'Unknown'}
        </p>
        <p className="text-sm mt-4">
          This file type cannot be previewed. Download to view.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-8 text-gray-400">
      Unknown preview type
    </div>
  );
}

function getLanguageFromMime(mimeType: string, fileName: string): string {
  // Try extension first
  const ext = fileName.split('.').pop()?.toLowerCase();
  const extMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    rs: 'rust',
    go: 'go',
    rb: 'ruby',
    php: 'php',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    fish: 'bash',
    ps1: 'powershell',
    sql: 'sql',
    html: 'html',
    htm: 'html',
    xml: 'xml',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    ini: 'ini',
    md: 'markdown',
    markdown: 'markdown',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    cmake: 'cmake',
    gradle: 'gradle',
    lua: 'lua',
    perl: 'perl',
    r: 'r',
    dart: 'dart',
    vue: 'vue',
    svelte: 'svelte',
  };

  if (ext && extMap[ext]) {
    return extMap[ext];
  }

  // Try MIME type
  if (mimeType.includes('javascript')) return 'javascript';
  if (mimeType.includes('typescript')) return 'typescript';
  if (mimeType.includes('python')) return 'python';
  if (mimeType.includes('json')) return 'json';
  if (mimeType.includes('xml')) return 'xml';
  if (mimeType.includes('html')) return 'html';
  if (mimeType.includes('css')) return 'css';

  return 'plaintext';
}
