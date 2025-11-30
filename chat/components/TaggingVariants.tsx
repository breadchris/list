import { Tag, X, Plus, Search } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface TaggingVariantProps {
  messageId: string;
  existingTags: string[];
  messageTags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

// Variant 1: Inline Pills with Horizontal Scroll
export function InlinePillsVariant({
  messageId,
  existingTags,
  messageTags,
  onAddTag,
  onRemoveTag,
}: TaggingVariantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredTags = existingTags.filter(
    (tag) =>
      tag.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !messageTags.includes(tag)
  );

  const canCreateNew = searchQuery.trim() && !existingTags.includes(searchQuery.trim());

  // Click-away auto-close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="contents">
      {/* Tag trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-300 transition-colors font-mono opacity-100"
      >
        <Tag className="w-3.5 h-3.5" />
        {messageTags.length > 0 && (
          <span className="text-xs">{messageTags.length}</span>
        )}
      </button>

      {/* Tag interface - renders below in parent */}
      {isOpen && (
        <div ref={containerRef} className="col-span-full mt-2 p-2 bg-neutral-900 border border-neutral-800 rounded w-full">
          {/* Current tags */}
          {messageTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {messageTags.map((tag) => {
                const isBotTag = tag === 'bot';
                const tagClassName = isBotTag
                  ? "inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600 text-blue-100 border border-blue-500 rounded text-xs font-mono"
                  : "inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-800 text-neutral-300 border border-neutral-700 rounded text-xs font-mono";
                const buttonClassName = isBotTag
                  ? "text-blue-300 hover:text-blue-100"
                  : "text-neutral-500 hover:text-neutral-300";

                return (
                  <span key={tag} className={tagClassName}>
                    {tag}
                    <button
                      onClick={() => onRemoveTag(tag)}
                      className={buttonClassName}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Search input */}
          <input
            type="text"
            placeholder="Search tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs font-mono text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-neutral-700 mb-2"
          />

          {/* Available tags - horizontal scroll */}
          <div className="overflow-x-auto">
            <div className="flex gap-1.5">
              {filteredTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    onAddTag(tag);
                    setSearchQuery('');
                  }}
                  className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-300 border border-neutral-700 hover:border-neutral-600 rounded text-xs font-mono whitespace-nowrap transition-colors"
                >
                  {tag}
                </button>
              ))}
              {canCreateNew && (
                <button
                  onClick={() => {
                    onAddTag(searchQuery.trim());
                    setSearchQuery('');
                  }}
                  className="px-2 py-0.5 bg-neutral-700 hover:bg-neutral-600 text-neutral-300 border border-neutral-600 rounded text-xs font-mono whitespace-nowrap transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Create &quot;{searchQuery.trim()}&quot;
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Variant 2: Compact Dropdown
export function CompactDropdownVariant({
  messageId,
  existingTags,
  messageTags,
  onAddTag,
  onRemoveTag,
}: TaggingVariantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTags = existingTags.filter(
    (tag) =>
      tag.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !messageTags.includes(tag)
  );

  const canCreateNew = searchQuery.trim() && !existingTags.includes(searchQuery.trim());

  return (
    <div className="ml-2 mt-1 relative">
      {/* Tag display */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-300 transition-colors font-mono opacity-100"
        >
          <Tag className="w-3.5 h-3.5" />
        </button>
        {messageTags.length > 0 && !isOpen && (
          <div className="flex gap-1">
            {messageTags.map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 bg-neutral-800 text-neutral-400 rounded text-xs font-mono"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 p-2 bg-neutral-950 border border-neutral-800 rounded shadow-lg z-10">
          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1.5 w-3 h-3 text-neutral-600" />
            <input
              type="text"
              placeholder="Search or create..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded pl-7 pr-2 py-1 text-xs font-mono text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-neutral-700"
            />
          </div>

          {/* Current tags */}
          {messageTags.length > 0 && (
            <div className="mb-2 pb-2 border-b border-neutral-800">
              <div className="text-xs text-neutral-600 mb-1 font-mono">Current:</div>
              <div className="flex flex-wrap gap-1">
                {messageTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => onRemoveTag(tag)}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-xs font-mono transition-colors"
                  >
                    {tag}
                    <X className="w-2.5 h-2.5" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Available tags */}
          <div className="max-h-32 overflow-y-auto space-y-1">
            {filteredTags.map((tag) => (
              <button
                key={tag}
                onClick={() => {
                  onAddTag(tag);
                  setSearchQuery('');
                }}
                className="w-full text-left px-2 py-1 hover:bg-neutral-900 text-neutral-400 hover:text-neutral-300 rounded text-xs font-mono transition-colors"
              >
                {tag}
              </button>
            ))}
            {canCreateNew && (
              <button
                onClick={() => {
                  onAddTag(searchQuery.trim());
                  setSearchQuery('');
                }}
                className="w-full text-left px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-xs font-mono transition-colors flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Create &quot;{searchQuery.trim()}&quot;
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Variant 3: Minimalist Inline Badge
export function MinimalistBadgeVariant({
  messageId,
  existingTags,
  messageTags,
  onAddTag,
  onRemoveTag,
}: TaggingVariantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTags = existingTags.filter(
    (tag) =>
      tag.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !messageTags.includes(tag)
  );

  const canCreateNew = searchQuery.trim() && !existingTags.includes(searchQuery.trim());

  return (
    <div className="ml-2 mt-1">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`text-neutral-500 hover:text-neutral-300 transition-colors ${messageTags.length > 0 ? 'text-neutral-400' : ''}`}
        >
          <Tag className="w-3.5 h-3.5" />
        </button>

        {/* Show tags inline when closed */}
        {!isOpen && messageTags.length > 0 && (
          <div className="flex gap-1 text-xs font-mono text-neutral-500">
            {messageTags.map((tag, i) => (
              <span key={tag}>
                #{tag}{i < messageTags.length - 1 ? ',' : ''}
              </span>
            ))}
          </div>
        )}

        {/* Expanded tag editor */}
        {isOpen && (
          <div className="flex items-center gap-1">
            {messageTags.map((tag) => (
              <button
                key={tag}
                onClick={() => onRemoveTag(tag)}
                className="px-1.5 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-300 rounded text-xs font-mono transition-colors"
              >
                #{tag} <X className="inline w-2.5 h-2.5 ml-0.5" />
              </button>
            ))}
            <input
              type="text"
              placeholder="tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  onAddTag(searchQuery.trim());
                  setSearchQuery('');
                }
              }}
              className="w-24 bg-transparent border-b border-neutral-800 focus:border-neutral-600 px-1 py-0.5 text-xs font-mono text-neutral-300 placeholder-neutral-600 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Tag suggestions */}
      {isOpen && searchQuery && (
        <div className="mt-1 ml-5 flex gap-1">
          {filteredTags.slice(0, 5).map((tag) => (
            <button
              key={tag}
              onClick={() => {
                onAddTag(tag);
                setSearchQuery('');
              }}
              className="px-1.5 py-0.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-500 hover:text-neutral-400 rounded text-xs font-mono transition-colors"
            >
              #{tag}
            </button>
          ))}
          {canCreateNew && (
            <button
              onClick={() => {
                onAddTag(searchQuery.trim());
                setSearchQuery('');
              }}
              className="px-1.5 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-300 rounded text-xs font-mono transition-colors"
            >
              + #{searchQuery.trim()}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Variant 4: Card-style Expandable Panel
export function CardStyleVariant({
  messageId,
  existingTags,
  messageTags,
  onAddTag,
  onRemoveTag,
}: TaggingVariantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTags = existingTags.filter(
    (tag) =>
      tag.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !messageTags.includes(tag)
  );

  const canCreateNew = searchQuery.trim() && !existingTags.includes(searchQuery.trim());

  return (
    <div className="ml-2 mt-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-300 transition-colors font-mono opacity-100"
      >
        <Tag className="w-3.5 h-3.5" />
        {messageTags.length > 0 && (
          <span className="text-xs">{messageTags.length}</span>
        )}
      </button>

      {isOpen && (
        <div className="mt-2 p-3 bg-neutral-900 border border-neutral-800 rounded">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-neutral-500">Message Tags</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-neutral-600 hover:text-neutral-400"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Applied tags */}
          {messageTags.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-neutral-600 mb-1.5 font-mono">Applied:</div>
              <div className="flex flex-wrap gap-1.5">
                {messageTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-2 py-1 bg-neutral-800 text-neutral-300 border border-neutral-700 rounded text-xs font-mono"
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                    <button
                      onClick={() => onRemoveTag(tag)}
                      className="text-neutral-500 hover:text-neutral-300 ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative mb-2">
            <input
              type="text"
              placeholder="Search or create tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-xs font-mono text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-neutral-700"
            />
          </div>

          {/* Available tags - scrollable */}
          <div className="text-xs text-neutral-600 mb-1.5 font-mono">Available:</div>
          <div className="overflow-x-auto pb-1">
            <div className="flex gap-1.5">
              {filteredTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    onAddTag(tag);
                    setSearchQuery('');
                  }}
                  className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-300 border border-neutral-700 hover:border-neutral-600 rounded text-xs font-mono whitespace-nowrap transition-colors"
                >
                  + {tag}
                </button>
              ))}
              {canCreateNew && (
                <button
                  onClick={() => {
                    onAddTag(searchQuery.trim());
                    setSearchQuery('');
                  }}
                  className="px-2 py-1 bg-neutral-700 hover:bg-neutral-600 text-neutral-300 border border-neutral-600 rounded text-xs font-mono whitespace-nowrap transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Create &quot;{searchQuery.trim()}&quot;
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Variant 5: Terminal-style Command Input
export function TerminalStyleVariant({
  messageId,
  existingTags,
  messageTags,
  onAddTag,
  onRemoveTag,
}: TaggingVariantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTags = existingTags.filter(
    (tag) =>
      tag.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !messageTags.includes(tag)
  );

  const canCreateNew = searchQuery.trim() && !existingTags.includes(searchQuery.trim());

  return (
    <div className="ml-2 mt-1">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-300 transition-colors font-mono opacity-100"
        >
          <Tag className="w-3.5 h-3.5" />
        </button>

        {!isOpen && messageTags.length > 0 && (
          <div className="font-mono text-xs text-neutral-500">
            [{messageTags.join(', ')}]
          </div>
        )}
      </div>

      {isOpen && (
        <div className="mt-2 p-2 bg-neutral-950 border border-neutral-800 rounded font-mono">
          {/* Command prompt style */}
          <div className="text-xs mb-2">
            {messageTags.length > 0 && (
              <div className="mb-1 text-neutral-600">
                <span className="text-neutral-500">tags:</span> [{messageTags.map((tag, i) => (
                  <button
                    key={tag}
                    onClick={() => onRemoveTag(tag)}
                    className="text-neutral-400 hover:text-neutral-300 hover:line-through"
                  >
                    {tag}{i < messageTags.length - 1 ? ', ' : ''}
                  </button>
                ))}]
              </div>
            )}
            <div className="flex items-center gap-1">
              <span className="text-neutral-600">$</span>
              <input
                type="text"
                placeholder="tag add..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    onAddTag(searchQuery.trim());
                    setSearchQuery('');
                  }
                }}
                className="flex-1 bg-transparent text-neutral-300 placeholder-neutral-700 focus:outline-none"
              />
            </div>
          </div>

          {/* Autocomplete suggestions */}
          {searchQuery && (
            <div className="space-y-0.5 text-xs">
              {filteredTags.slice(0, 4).map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    onAddTag(tag);
                    setSearchQuery('');
                  }}
                  className="block w-full text-left px-2 py-0.5 hover:bg-neutral-900 text-neutral-500 hover:text-neutral-400 rounded transition-colors"
                >
                  <span className="text-neutral-700">→</span> {tag}
                </button>
              ))}
              {canCreateNew && (
                <button
                  onClick={() => {
                    onAddTag(searchQuery.trim());
                    setSearchQuery('');
                  }}
                  className="block w-full text-left px-2 py-0.5 hover:bg-neutral-900 text-neutral-400 hover:text-neutral-300 rounded transition-colors"
                >
                  <span className="text-neutral-600">+</span> create: {searchQuery.trim()}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Demo component to showcase all variants
export function TaggingVariantsDemo() {
  const [variantStates, setVariantStates] = useState<Record<string, string[]>>({
    variant1: ['urgent', 'bug'],
    variant2: [],
    variant3: ['feature-request'],
    variant4: ['documentation', 'help-wanted'],
    variant5: ['v2.0'],
  });

  const existingTags = [
    'bug',
    'feature-request',
    'urgent',
    'documentation',
    'help-wanted',
    'v2.0',
    'enhancement',
    'question',
    'wip',
    'blocked',
  ];

  const handleAddTag = (variantId: string, tag: string) => {
    setVariantStates((prev) => ({
      ...prev,
      [variantId]: [...(prev[variantId] || []), tag],
    }));
  };

  const handleRemoveTag = (variantId: string, tag: string) => {
    setVariantStates((prev) => ({
      ...prev,
      [variantId]: (prev[variantId] || []).filter((t) => t !== tag),
    }));
  };

  return (
    <div className="space-y-4 p-4 bg-neutral-950 rounded border border-neutral-800">
      <div className="text-sm font-mono text-neutral-400 mb-4">
        Message Tagging UI Variants
      </div>

      <div className="space-y-6">
        {/* Variant 1 */}
        <div className="border-l-2 border-neutral-800 pl-3">
          <div className="text-xs font-mono text-neutral-600 mb-2">
            1. Inline Pills with Horizontal Scroll
          </div>
          <InlinePillsVariant
            messageId="msg1"
            existingTags={existingTags}
            messageTags={variantStates.variant1}
            onAddTag={(tag) => handleAddTag('variant1', tag)}
            onRemoveTag={(tag) => handleRemoveTag('variant1', tag)}
          />
        </div>

        {/* Variant 2 */}
        <div className="border-l-2 border-neutral-800 pl-3">
          <div className="text-xs font-mono text-neutral-600 mb-2">
            2. Compact Dropdown
          </div>
          <CompactDropdownVariant
            messageId="msg2"
            existingTags={existingTags}
            messageTags={variantStates.variant2}
            onAddTag={(tag) => handleAddTag('variant2', tag)}
            onRemoveTag={(tag) => handleRemoveTag('variant2', tag)}
          />
        </div>

        {/* Variant 3 */}
        <div className="border-l-2 border-neutral-800 pl-3">
          <div className="text-xs font-mono text-neutral-600 mb-2">
            3. Minimalist Inline Badge
          </div>
          <MinimalistBadgeVariant
            messageId="msg3"
            existingTags={existingTags}
            messageTags={variantStates.variant3}
            onAddTag={(tag) => handleAddTag('variant3', tag)}
            onRemoveTag={(tag) => handleRemoveTag('variant3', tag)}
          />
        </div>

        {/* Variant 4 */}
        <div className="border-l-2 border-neutral-800 pl-3">
          <div className="text-xs font-mono text-neutral-600 mb-2">
            4. Card-style Expandable Panel
          </div>
          <CardStyleVariant
            messageId="msg4"
            existingTags={existingTags}
            messageTags={variantStates.variant4}
            onAddTag={(tag) => handleAddTag('variant4', tag)}
            onRemoveTag={(tag) => handleRemoveTag('variant4', tag)}
          />
        </div>

        {/* Variant 5 */}
        <div className="border-l-2 border-neutral-800 pl-3">
          <div className="text-xs font-mono text-neutral-600 mb-2">
            5. Terminal-style Command Input
          </div>
          <TerminalStyleVariant
            messageId="msg5"
            existingTags={existingTags}
            messageTags={variantStates.variant5}
            onAddTag={(tag) => handleAddTag('variant5', tag)}
            onRemoveTag={(tag) => handleRemoveTag('variant5', tag)}
          />
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-neutral-800 text-xs font-mono text-neutral-600">
        Click the tag icons to explore each variant&apos;s interaction pattern
      </div>
    </div>
  );
}

// Standalone wrappers for individual variants
const existingTagsList = [
  'bug',
  'feature-request',
  'urgent',
  'documentation',
  'help-wanted',
  'v2.0',
  'enhancement',
  'question',
  'wip',
  'blocked',
];

export function InlinePillsVariantDemo() {
  const [messageTags, setMessageTags] = useState<string[]>(['urgent', 'bug']);

  return (
    <InlinePillsVariant
      messageId="demo-inline"
      existingTags={existingTagsList}
      messageTags={messageTags}
      onAddTag={(tag) => setMessageTags([...messageTags, tag])}
      onRemoveTag={(tag) => setMessageTags(messageTags.filter((t) => t !== tag))}
    />
  );
}

export function CompactDropdownVariantDemo() {
  const [messageTags, setMessageTags] = useState<string[]>([]);

  return (
    <CompactDropdownVariant
      messageId="demo-dropdown"
      existingTags={existingTagsList}
      messageTags={messageTags}
      onAddTag={(tag) => setMessageTags([...messageTags, tag])}
      onRemoveTag={(tag) => setMessageTags(messageTags.filter((t) => t !== tag))}
    />
  );
}

export function MinimalistBadgeVariantDemo() {
  const [messageTags, setMessageTags] = useState<string[]>(['feature-request']);

  return (
    <MinimalistBadgeVariant
      messageId="demo-badge"
      existingTags={existingTagsList}
      messageTags={messageTags}
      onAddTag={(tag) => setMessageTags([...messageTags, tag])}
      onRemoveTag={(tag) => setMessageTags(messageTags.filter((t) => t !== tag))}
    />
  );
}

export function CardStyleVariantDemo() {
  const [messageTags, setMessageTags] = useState<string[]>(['documentation', 'help-wanted']);

  return (
    <CardStyleVariant
      messageId="demo-card"
      existingTags={existingTagsList}
      messageTags={messageTags}
      onAddTag={(tag) => setMessageTags([...messageTags, tag])}
      onRemoveTag={(tag) => setMessageTags(messageTags.filter((t) => t !== tag))}
    />
  );
}

export function TerminalStyleVariantDemo() {
  const [messageTags, setMessageTags] = useState<string[]>(['v2.0']);

  return (
    <TerminalStyleVariant
      messageId="demo-terminal"
      existingTags={existingTagsList}
      messageTags={messageTags}
      onAddTag={(tag) => setMessageTags([...messageTags, tag])}
      onRemoveTag={(tag) => setMessageTags(messageTags.filter((t) => t !== tag))}
    />
  );
}