import React, { useEffect, useRef } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
// import 'prismjs/themes/prism.css';

interface JsContentDisplayProps {
  code: string;
  className?: string;
  maxLines?: number;
}

export const JsContentDisplay: React.FC<JsContentDisplayProps> = ({ 
  code, 
  className = '', 
  maxLines = 10 
}) => {
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current);
    }
  }, [code]);

  // Truncate code if it exceeds maxLines
  const lines = code.split('\n');
  const truncated = lines.length > maxLines;
  const displayCode = truncated ? lines.slice(0, maxLines).join('\n') : code;

  return (
    <div className={`relative ${className}`}>
      <pre className="text-sm bg-gray-50 border rounded-md p-3 overflow-x-auto">
        <code ref={codeRef} className="language-javascript">
          {displayCode}
        </code>
      </pre>
      {truncated && (
        <div className="text-xs text-gray-500 mt-1">
          ... {lines.length - maxLines} more lines
        </div>
      )}
    </div>
  );
};