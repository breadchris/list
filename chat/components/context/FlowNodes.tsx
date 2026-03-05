import React, { memo, useCallback, useRef } from 'react';
import { Handle, Position, NodeResizer, NodeToolbar, useReactFlow } from 'reactflow';
import { Trash2, Copy, MoreHorizontal } from 'lucide-react';
import { Editor } from './Editor';

const STICKY_COLORS = [
    '#fff740', // Yellow
    '#ff7eb6', // Pink
    '#7afcff', // Cyan
    '#feff9c', // Light Yellow
    '#ffc9c9', // Light Red
];

const SHAPE_COLORS = [
    '#ffffff', // White
    '#f8f9fa', // Gray
    '#e9ecef', // Darker Gray
    '#ffc9c9', // Red
    '#b2f2bb', // Green
    '#a5d8ff', // Blue
];

// Helper to update node data
const useNodeDataUpdate = (id: string) => {
    const { setNodes } = useReactFlow();
    
    const updateLabel = useCallback((label: string) => {
        setNodes((nds) => nds.map((n) => {
            if (n.id === id) {
                return { ...n, data: { ...n.data, label } };
            }
            return n;
        }));
    }, [id, setNodes]);

    const updateColor = useCallback((color: string) => {
        setNodes((nds) => nds.map((n) => {
            if (n.id === id) {
                return { ...n, data: { ...n.data, color } };
            }
            return n;
        }));
    }, [id, setNodes]);

    const updateShape = useCallback((shape: string) => {
        setNodes((nds) => nds.map((n) => {
            if (n.id === id) {
                return { ...n, data: { ...n.data, shape } };
            }
            return n;
        }));
    }, [id, setNodes]);

    return { updateLabel, updateColor, updateShape };
};

export const StickyNode = memo(({ id, data, selected }: any) => {
    const { updateLabel, updateColor } = useNodeDataUpdate(id);
    const { deleteElements } = useReactFlow();

    return (
        <>
            <NodeToolbar isVisible={selected} position={Position.Top} className="flex gap-1 bg-background p-1.5 rounded-lg shadow-xl border border-border">
                {STICKY_COLORS.map(c => (
                    <button 
                        key={c} 
                        onClick={() => updateColor(c)} 
                        className={`w-5 h-5 rounded-full border border-black/10 transition-transform hover:scale-110 ${data.color === c ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
                        style={{ backgroundColor: c }}
                    />
                ))}
                <div className="w-px h-5 bg-border mx-1" />
                <button onClick={() => deleteElements({ nodes: [{ id }] })} className="text-muted-foreground hover:text-red-500 p-0.5">
                    <Trash2 className="w-4 h-4" />
                </button>
            </NodeToolbar>

            <div 
                className={`shadow-md hover:shadow-lg transition-all rounded-sm border-0 p-4 w-full h-full min-w-[150px] min-h-[150px] flex flex-col items-center justify-center text-center group`} 
                style={{ backgroundColor: data.color || '#fff740' }}
            >
                {/* Handles */}
                <Handle type="target" position={Position.Top} className="opacity-0 group-hover:opacity-100 !bg-slate-400/50 !w-3 !h-3 !-top-1.5 !border-0 transition-opacity" />
                <Handle type="target" position={Position.Left} className="opacity-0 group-hover:opacity-100 !bg-slate-400/50 !w-3 !h-3 !-left-1.5 !border-0 transition-opacity" />
                <Handle type="source" position={Position.Right} className="opacity-0 group-hover:opacity-100 !bg-slate-400/50 !w-3 !h-3 !-right-1.5 !border-0 transition-opacity" />
                <Handle type="source" position={Position.Bottom} className="opacity-0 group-hover:opacity-100 !bg-slate-400/50 !w-3 !h-3 !-bottom-1.5 !border-0 transition-opacity" />
                
                <textarea 
                    className="w-full h-full bg-transparent resize-none outline-none text-center font-medium text-foreground placeholder-foreground/30 text-lg leading-relaxed nodrag cursor-text" 
                    placeholder="Idea..."
                    value={data.label}
                    onChange={(evt) => updateLabel(evt.target.value)}
                    style={{ fontFamily: '"Comic Sans MS", "Chalkboard SE", sans-serif' }}
                />
            </div>
        </>
    );
});

export const ShapeNode = memo(({ id, data, selected }: any) => {
    const { updateLabel, updateColor, updateShape } = useNodeDataUpdate(id);
    const { deleteElements } = useReactFlow();
    const shape = data.shape || 'rectangle';

    const getShapeStyles = () => {
        const base = { backgroundColor: data.color || '#ffffff' };
        switch(shape) {
            case 'circle': return { ...base, borderRadius: '50%' };
            case 'rounded': return { ...base, borderRadius: '16px' };
            default: return { ...base, borderRadius: '0px' };
        }
    };

    return (
        <>
            <NodeResizer minWidth={100} minHeight={50} isVisible={selected} lineClassName="border-indigo-400" handleClassName="h-2.5 w-2.5 bg-background border-2 border-indigo-500 rounded-sm" />
            
            <NodeToolbar isVisible={selected} position={Position.Top} className="flex gap-1 bg-background p-1.5 rounded-lg shadow-xl border border-border items-center">
                 <div className="flex gap-1">
                    <button onClick={() => updateShape('rectangle')} className={`p-1 rounded hover:bg-accent ${shape === 'rectangle' ? 'bg-indigo-50 text-indigo-600' : 'text-muted-foreground'}`} title="Rectangle"><div className="w-4 h-4 border-2 border-current" /></button>
                    <button onClick={() => updateShape('rounded')} className={`p-1 rounded hover:bg-accent ${shape === 'rounded' ? 'bg-indigo-50 text-indigo-600' : 'text-muted-foreground'}`} title="Rounded"><div className="w-4 h-4 border-2 border-current rounded-md" /></button>
                    <button onClick={() => updateShape('circle')} className={`p-1 rounded hover:bg-accent ${shape === 'circle' ? 'bg-indigo-50 text-indigo-600' : 'text-muted-foreground'}`} title="Circle"><div className="w-4 h-4 border-2 border-current rounded-full" /></button>
                 </div>
                 <div className="w-px h-5 bg-border mx-1" />
                 <div className="flex gap-1">
                    {SHAPE_COLORS.map(c => (
                        <button 
                            key={c} 
                            onClick={() => updateColor(c)} 
                            className={`w-4 h-4 rounded-full border border-black/10 ${data.color === c ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                 </div>
                 <div className="w-px h-5 bg-border mx-1" />
                 <button onClick={() => deleteElements({ nodes: [{ id }] })} className="text-muted-foreground hover:text-red-500 p-0.5">
                    <Trash2 className="w-4 h-4" />
                 </button>
            </NodeToolbar>

            <div className={`w-full h-full min-w-[50px] min-h-[50px] relative group`}>
                <div 
                    className={`absolute inset-0 border-2 transition-all shadow-sm ${selected ? 'border-indigo-500' : 'border-foreground'}`}
                    style={getShapeStyles()}
                />
                
                <div className="absolute inset-0 flex items-center justify-center p-2 z-10">
                    <textarea 
                        className="w-full bg-transparent resize-none outline-none text-center font-bold text-foreground placeholder-muted-foreground/50 nodrag cursor-text overflow-hidden" 
                        placeholder="Label"
                        value={data.label}
                        onChange={(evt) => updateLabel(evt.target.value)}
                        style={{ height: '100%' }}
                    />
                </div>

                {/* Handles */}
                <Handle type="target" position={Position.Top} className="opacity-0 group-hover:opacity-100 !bg-slate-400/50 !w-3 !h-3 !-top-1.5 !border-0 z-20" />
                <Handle type="target" position={Position.Left} className="opacity-0 group-hover:opacity-100 !bg-slate-400/50 !w-3 !h-3 !-left-1.5 !border-0 z-20" />
                <Handle type="source" position={Position.Right} className="opacity-0 group-hover:opacity-100 !bg-slate-400/50 !w-3 !h-3 !-right-1.5 !border-0 z-20" />
                <Handle type="source" position={Position.Bottom} className="opacity-0 group-hover:opacity-100 !bg-slate-400/50 !w-3 !h-3 !-bottom-1.5 !border-0 z-20" />
            </div>
        </>
    );
});

export const TextNode = memo(({ id, data, selected }: any) => {
    const { updateLabel } = useNodeDataUpdate(id);
    const { deleteElements } = useReactFlow();

    return (
        <>
             <NodeToolbar isVisible={selected} position={Position.Top} className="flex gap-1 bg-background p-1.5 rounded-lg shadow-xl border border-border items-center">
                 <button onClick={() => deleteElements({ nodes: [{ id }] })} className="text-muted-foreground hover:text-red-500 p-0.5">
                    <Trash2 className="w-4 h-4" />
                 </button>
            </NodeToolbar>

            <div className={`min-w-[50px] relative group`}>
                {selected && <div className="absolute -inset-2 border border-indigo-500 border-dashed rounded-lg pointer-events-none" />}
                <textarea
                    className="w-full bg-transparent resize-none outline-none text-center font-medium text-foreground text-2xl placeholder-muted-foreground nodrag cursor-text overflow-hidden"
                    placeholder="Type..."
                    value={data.label}
                    onChange={(evt) => {
                        updateLabel(evt.target.value);
                        evt.target.style.height = 'auto';
                        evt.target.style.height = evt.target.scrollHeight + 'px';
                    }}
                    rows={1}
                    style={{ height: 'auto' }}
                />
                 {/* Handles - smaller and subtler for text */}
                <Handle type="target" position={Position.Top} className="opacity-0 group-hover:opacity-100 !bg-slate-400/50 !w-2 !h-2 !-top-1 !border-0" />
                <Handle type="target" position={Position.Left} className="opacity-0 group-hover:opacity-100 !bg-slate-400/50 !w-2 !h-2 !-left-1 !border-0" />
                <Handle type="source" position={Position.Right} className="opacity-0 group-hover:opacity-100 !bg-slate-400/50 !w-2 !h-2 !-right-1 !border-0" />
                <Handle type="source" position={Position.Bottom} className="opacity-0 group-hover:opacity-100 !bg-slate-400/50 !w-2 !h-2 !-bottom-1 !border-0" />
            </div>
        </>
    );
});

export const WikiNode = memo(({ id, data, selected }: any) => {
    const { deleteElements } = useReactFlow();
    const editorRef = useRef<any>(null);

    return (
        <>
            <NodeResizer minWidth={300} minHeight={200} isVisible={selected} lineClassName="border-indigo-400" handleClassName="h-2.5 w-2.5 bg-background border-2 border-indigo-500 rounded-sm" />

            <NodeToolbar isVisible={selected} position={Position.Top} className="flex gap-1 bg-background p-1.5 rounded-lg shadow-xl border border-border items-center">
                <button onClick={() => deleteElements({ nodes: [{ id }] })} className="text-muted-foreground hover:text-red-500 p-0.5">
                    <Trash2 className="w-4 h-4" />
                </button>
            </NodeToolbar>

            <div className="w-full h-full min-w-[300px] min-h-[200px] bg-background rounded-lg border border-border shadow-sm overflow-hidden group nodrag">
                {/* Handles */}
                <Handle type="target" position={Position.Top} className="opacity-0 group-hover:opacity-100 !bg-slate-400/50 !w-3 !h-3 !-top-1.5 !border-0 z-20" />
                <Handle type="target" position={Position.Left} className="opacity-0 group-hover:opacity-100 !bg-slate-400/50 !w-3 !h-3 !-left-1.5 !border-0 z-20" />
                <Handle type="source" position={Position.Right} className="opacity-0 group-hover:opacity-100 !bg-slate-400/50 !w-3 !h-3 !-right-1.5 !border-0 z-20" />
                <Handle type="source" position={Position.Bottom} className="opacity-0 group-hover:opacity-100 !bg-slate-400/50 !w-3 !h-3 !-bottom-1.5 !border-0 z-20" />

                <div className="w-full h-full overflow-auto">
                    <Editor
                        ref={editorRef}
                        sessionId={`wiki-node-${id}`}
                        groupId={data.groupId}
                        userId={data.userId}
                        supabase={data.supabase}
                    />
                </div>
            </div>
        </>
    );
});
