import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, FileText, Folder, Plus, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';

interface WikiTreeProps {
  paths: string[];
  currentPath: string | null;
  onSelect: (path: string) => void;
  onCreatePage: (path: string) => void;
}

interface TreeNode {
  name: string;
  fullPath: string;
  children: Record<string, TreeNode>;
}

function buildTree(paths: string[]): Record<string, TreeNode> {
  const root: Record<string, TreeNode> = {};

  paths.forEach(path => {
    const parts = path.split('/');
    let currentLevel = root;
    let currentPath = '';

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      
      if (!currentLevel[part]) {
        currentLevel[part] = {
          name: part,
          fullPath: currentPath,
          children: {}
        };
      }
      currentLevel = currentLevel[part].children;
    });
  });

  return root;
}

function TreeNodeItem({ 
  node, 
  depth, 
  currentPath, 
  onSelect, 
  expandedPaths, 
  toggleExpand 
}: { 
  node: TreeNode; 
  depth: number; 
  currentPath: string | null;
  onSelect: (path: string) => void;
  expandedPaths: Set<string>;
  toggleExpand: (path: string) => void;
}) {
  const hasChildren = Object.keys(node.children).length > 0;
  const isExpanded = expandedPaths.has(node.fullPath);
  const isSelected = currentPath === node.fullPath;

  return (
    <div className="select-none">
      <div 
        className={clsx(
          "flex items-center gap-1.5 py-1.5 px-2 rounded-md cursor-pointer transition-colors text-sm",
          isSelected ? "bg-indigo-50 text-indigo-700 font-medium" : "hover:bg-slate-100 text-slate-700",
          depth > 0 && "ml-4" // Indentation
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => {
             // If clicking the node itself, select it. 
             // If it has children, maybe expand it? 
             // Requirement: "user could still click 'asdf' to view its page and need to expand the 'asdf' path to view 'fdsa'"
             // So click selects. Expand button expands.
             onSelect(node.fullPath);
        }}
      >
        <button 
            onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.fullPath);
            }}
            className={clsx(
                "p-0.5 rounded hover:bg-slate-200 transition-colors",
                !hasChildren && "opacity-0 pointer-events-none"
            )}
        >
            {isExpanded ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
        </button>
        
        {hasChildren ? (
            <Folder className={clsx("w-3.5 h-3.5", isSelected ? "text-indigo-500" : "text-slate-400")} />
        ) : (
            <FileText className={clsx("w-3.5 h-3.5", isSelected ? "text-indigo-500" : "text-slate-400")} />
        )}
        
        <span className="truncate">{node.name}</span>
      </div>

      <AnimatePresence>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {Object.values(node.children)
                .sort((a, b) => {
                    // Folders first, then files? Or alphabetical?
                    // Alphabetical for now
                    return a.name.localeCompare(b.name);
                })
                .map(child => (
                    <TreeNodeItem 
                        key={child.fullPath} 
                        node={child} 
                        depth={depth + 1} 
                        currentPath={currentPath}
                        onSelect={onSelect}
                        expandedPaths={expandedPaths}
                        toggleExpand={toggleExpand}
                    />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function WikiTree({ paths, currentPath, onSelect, onCreatePage }: WikiTreeProps) {
  const tree = useMemo(() => buildTree(paths), [paths]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [newPathName, setNewPathName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const toggleExpand = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };
  
  // Flatten tree for search if needed, but simple filtering of `paths` is easier
  const filteredPaths = useMemo(() => {
      if (!searchQuery) return paths;
      return paths.filter(p => p.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [paths, searchQuery]);
  
  const displayTree = useMemo(() => buildTree(filteredPaths), [filteredPaths]);

  const handleCreate = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newPathName.trim()) return;
      
      // Clean path
      let cleanPath = newPathName.trim().replace(/^\/+|\/+$/g, ''); // trim slashes
      if (!cleanPath) return;

      // If user provided a relative name and a parent is selected?
      // For now, assume absolute path from root or relative to nothing.
      // Maybe if currentPath is selected, default to currentPath/newName?
      // Let's stick to explicit full path for simplicity or handle relative logic:
      // "Enter path (e.g. notes/todo)"
      
      onCreatePage(cleanPath);
      setNewPathName('');
      setIsCreating(false);
      
      // Auto expand parents
      const parts = cleanPath.split('/');
      let walker = '';
      const newExpanded = new Set(expandedPaths);
      parts.slice(0, -1).forEach(part => {
          walker = walker ? `${walker}/${part}` : part;
          newExpanded.add(walker);
      });
      setExpandedPaths(newExpanded);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
        <div className="p-3 border-b border-slate-200 space-y-2">
            <div className="relative">
                <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="Search pages..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-7 pr-2 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
            </div>
            <button 
                onClick={() => setIsCreating(true)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50 hover:border-indigo-200 hover:text-indigo-600 transition-colors shadow-sm"
            >
                <Plus className="w-3.5 h-3.5" />
                New Page
            </button>
        </div>

        {isCreating && (
            <div className="p-2 bg-indigo-50 border-b border-indigo-100">
                <form onSubmit={handleCreate} className="space-y-2">
                    <label className="text-[10px] font-medium text-indigo-800 uppercase">Page Path</label>
                    <input 
                        type="text" 
                        autoFocus
                        placeholder="e.g. project/notes"
                        value={newPathName}
                        onChange={e => setNewPathName(e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-indigo-200 rounded focus:outline-none focus:border-indigo-400"
                    />
                    <div className="flex justify-end gap-2">
                        <button 
                            type="button" 
                            onClick={() => setIsCreating(false)}
                            className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 font-medium"
                        >
                            Create
                        </button>
                    </div>
                </form>
            </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-200">
            {Object.keys(displayTree).length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                    <p className="text-xs">No pages found.</p>
                </div>
            ) : (
                Object.values(displayTree)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(node => (
                        <TreeNodeItem 
                            key={node.fullPath} 
                            node={node} 
                            depth={0} 
                            currentPath={currentPath}
                            onSelect={onSelect}
                            expandedPaths={expandedPaths}
                            toggleExpand={toggleExpand}
                        />
                ))
            )}
        </div>
    </div>
  );
}
