import React, { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import ReactFlow, { 
  Controls, 
  Background, 
  addEdge,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  useReactFlow,
  Panel,
  MarkerType,
  BackgroundVariant,
  useNodes,
  useEdges,
  ConnectionMode
} from 'reactflow';
import 'reactflow/dist/style.css';
import { SupabaseClient } from '@supabase/supabase-js';
import { IPane, PaneContent } from '../types';
import { Save, MousePointer2, StickyNote, Square, Type, Hand } from 'lucide-react';
import { clsx } from 'clsx';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import dagre from 'dagre';
import { StickyNode, ShapeNode, TextNode } from './FlowNodes';
import SimpleFloatingEdge from './FlowEdges';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-61781242`;

type Tool = 'select' | 'hand' | 'sticky' | 'shape' | 'text';

function FlowToolbar({ 
    currentTool, 
    setTool,
    onSave,
    saveStatus,
    isLoaded
}: { 
    currentTool: Tool; 
    setTool: (t: Tool) => void;
    onSave: () => void;
    saveStatus: 'idle' | 'saving' | 'saved' | 'error';
    isLoaded: boolean;
}) {
    return (
        <Panel position="bottom-center" className="mb-8 flex flex-col items-center gap-4">
             {/* Status Pill */}
             <div className="bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm border border-slate-200 text-[10px] text-slate-500 flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${isLoaded ? 'bg-green-500' : 'bg-orange-500 animate-pulse'}`} />
                {isLoaded ? (saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Ready') : 'Connecting...'}
                {saveStatus === 'error' && <span className="text-red-500">Error saving</span>}
             </div>

            <div className="flex items-center gap-2 bg-white p-2 rounded-2xl shadow-2xl border border-slate-100 ring-1 ring-black/5">
                <button 
                    onClick={() => setTool('select')} 
                    className={clsx("p-3 rounded-xl transition-all", currentTool === 'select' ? "bg-indigo-600 text-white shadow-md scale-105" : "hover:bg-slate-100 text-slate-500")} 
                    title="Select (V)"
                >
                    <MousePointer2 className="w-5 h-5" />
                </button>
                <button 
                    onClick={() => setTool('hand')} 
                    className={clsx("p-3 rounded-xl transition-all", currentTool === 'hand' ? "bg-indigo-600 text-white shadow-md scale-105" : "hover:bg-slate-100 text-slate-500")} 
                    title="Hand (H)"
                >
                    <Hand className="w-5 h-5" />
                </button>
                <div className="w-px h-8 bg-slate-200 mx-1" />
                <button 
                    onClick={() => setTool('sticky')} 
                    className={clsx("p-3 rounded-xl transition-all", currentTool === 'sticky' ? "bg-indigo-600 text-white shadow-md scale-105" : "hover:bg-slate-100 text-slate-500")} 
                    title="Sticky Note (S)"
                >
                    <StickyNote className="w-5 h-5" />
                </button>
                <button 
                    onClick={() => setTool('shape')} 
                    className={clsx("p-3 rounded-xl transition-all", currentTool === 'shape' ? "bg-indigo-600 text-white shadow-md scale-105" : "hover:bg-slate-100 text-slate-500")} 
                    title="Shape (R)"
                >
                    <Square className="w-5 h-5" />
                </button>
                <button 
                    onClick={() => setTool('text')} 
                    className={clsx("p-3 rounded-xl transition-all", currentTool === 'text' ? "bg-indigo-600 text-white shadow-md scale-105" : "hover:bg-slate-100 text-slate-500")} 
                    title="Text (T)"
                >
                    <Type className="w-5 h-5" />
                </button>
                
                <div className="w-px h-8 bg-slate-200 mx-1" />
                
                <button
                    onClick={onSave}
                    disabled={saveStatus === 'saving' || !isLoaded}
                    className={clsx(
                        "p-3 rounded-xl transition-all relative flex items-center justify-center",
                        saveStatus === 'saved' ? "text-green-600 bg-green-50" : 
                        "text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                    )}
                    title="Save Version"
                >
                    <Save className="w-5 h-5" />
                </button>
            </div>
        </Panel>
    );
}

const FlowCanvas = forwardRef<IPane, { 
    sessionId: string; 
    supabase: SupabaseClient;
    pendingActions?: any[];
    onActionsApplied?: () => void;
    onChange?: () => void;
}>(({ 
    sessionId, 
    supabase,
    pendingActions,
    onActionsApplied,
    onChange
}, ref) => {
    // Custom Node Types
    const nodeTypes = useMemo(() => ({
        sticky: StickyNode,
        shape: ShapeNode,
        text: TextNode
    }), []);

    const edgeTypes = useMemo(() => ({
        floating: SimpleFloatingEdge,
    }), []);

    // Uncontrolled state: Use hooks to access store
    const nodes = useNodes();
    const edges = useEdges();
    const { setNodes, setEdges, fitView, screenToFlowPosition } = useReactFlow();
    
    const [isLoaded, setIsLoaded] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const isRemoteUpdate = useRef(false);
    
    // Tools
    const [currentTool, setCurrentTool] = useState<Tool>('select');

    useImperativeHandle(ref, () => ({
        acceptContent: (content: PaneContent) => {
             if (content.text) {
                 const x = 100 + Math.random() * 50;
                 const y = 100 + Math.random() * 50;
                 const newNode: Node = {
                     id: crypto.randomUUID(),
                     type: 'sticky',
                     position: { x: nodes.length > 0 ? nodes[nodes.length-1].position.x + 200 : x, y: nodes.length > 0 ? nodes[nodes.length-1].position.y : y },
                     data: { label: content.text, color: '#fff740' }
                 };
                 setNodes((nds) => [...nds, newNode]);
             }
        }
    }));

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'INPUT') return;
            
            switch(e.key.toLowerCase()) {
                case 'v': setCurrentTool('select'); break;
                case 'h': setCurrentTool('hand'); break;
                case 's': setCurrentTool('sticky'); break;
                case 'r': setCurrentTool('shape'); break;
                case 't': setCurrentTool('text'); break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Initial Load & Realtime
    useEffect(() => {
        let active = true;
        async function load() {
            try {
                const response = await fetch(`${SERVER_URL}/flow/state?sessionId=${sessionId}`, {
                    headers: { 'Authorization': `Bearer ${publicAnonKey}` }
                });
                
                if (active && response.ok) {
                    const data = await response.json();
                    if (data && data.value) {
                        isRemoteUpdate.current = true;
                        if (data.value.nodes) setNodes(data.value.nodes);
                        if (data.value.edges) setEdges(data.value.edges);
                        setTimeout(() => fitView(), 100);
                    }
                }
            } catch (e) {
                console.error("Error loading flow state", e);
            } finally {
                if (active) setIsLoaded(true);
            }
        }
        load();
        return () => { active = false; };
    }, [sessionId]);

    useEffect(() => {
        const channelName = `flow-${sessionId}`;
        const channel = supabase.channel(channelName, { config: { broadcast: { self: false } } });
        channel.on('broadcast', { event: 'flow-update' }, ({ payload }) => {
            if (payload.sessionId === sessionId) {
                isRemoteUpdate.current = true;
                if (payload.nodes) setNodes(payload.nodes);
                if (payload.edges) setEdges(payload.edges);
            }
        });
        channel.subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [sessionId, supabase]);

    // Pending Actions Logic
    useEffect(() => {
        if (pendingActions && pendingActions.length > 0 && isLoaded) {
            let newNodes = [...nodes];
            let newEdges = [...edges];
            let changed = false;

            pendingActions.forEach(action => {
                if (action.type === 'add_flow_node') {
                    const x = 100 + (newNodes.length * 200) + Math.random() * 50;
                    const y = 100 + (newNodes.length * 50) + Math.random() * 50;
                    
                    const newNode: Node = {
                        id: crypto.randomUUID(),
                        type: 'sticky', 
                        position: { x, y },
                        data: { label: action.label, color: '#fff740' }
                    };
                    newNodes.push(newNode);
                    changed = true;
                } else if (action.type === 'connect_flow_nodes') {
                    const source = newNodes.find(n => n.data.label?.toLowerCase().includes(action.sourceLabel.toLowerCase()));
                    const target = newNodes.find(n => n.data.label?.toLowerCase().includes(action.targetLabel.toLowerCase()));
                    if (source && target) {
                        newEdges.push({
                            id: crypto.randomUUID(),
                            source: source.id,
                            target: target.id,
                            label: action.label,
                            type: 'floating',
                            markerEnd: { type: MarkerType.ArrowClosed }
                        });
                        changed = true;
                    }
                } else if (action.type === 'layout_flow_nodes') {
                    const dagreGraph = new dagre.graphlib.Graph();
                    dagreGraph.setDefaultEdgeLabel(() => ({}));
                    dagreGraph.setGraph({ rankdir: 'TB', ranksep: 100, nodesep: 50 });
                    newNodes.forEach((node) => dagreGraph.setNode(node.id, { width: 200, height: 200 }));
                    newEdges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));
                    dagre.layout(dagreGraph);
                    newNodes = newNodes.map((node) => {
                        const pos = dagreGraph.node(node.id);
                        return { ...node, position: { x: pos.x - 100, y: pos.y - 100 } };
                    });
                    changed = true;
                }
            });

            if (changed) {
                setNodes(newNodes);
                setEdges(newEdges);
                if (onActionsApplied) onActionsApplied();
                saveToDb(newNodes, newEdges);
            }
        }
    }, [pendingActions, isLoaded]); // Removed nodes/edges from dependency because we use them from hook (which triggers re-render)

    const onConnect = useCallback((params: Connection) => {
        setEdges((eds) => addEdge({ ...params, type: 'floating', markerEnd: { type: MarkerType.ArrowClosed } }, eds));
    }, [setEdges]);

    // Broadcast & Save
    useEffect(() => {
        if (!isLoaded || isRemoteUpdate.current) {
            isRemoteUpdate.current = false;
            return;
        }
        const timeout = setTimeout(() => {
            supabase.channel(`flow-${sessionId}`).send({
                type: 'broadcast',
                event: 'flow-update',
                payload: { sessionId, nodes, edges }
            }).catch(e => console.error("Broadcast error", e));
        }, 100);
        return () => clearTimeout(timeout);
    }, [nodes, edges, isLoaded, sessionId, supabase]);

    const saveToDb = async (currentNodes: Node[], currentEdges: Edge[]) => {
        try {
            await fetch(`${SERVER_URL}/flow/state`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
                body: JSON.stringify({ sessionId, value: { nodes: currentNodes, edges: currentEdges, updatedAt: new Date().toISOString() } })
            });
        } catch (e) { console.error("Failed to save flow state", e); }
    };

    useEffect(() => {
        if (!isLoaded) return;
        const timeout = setTimeout(() => {
            saveToDb(nodes, edges);
            if (onChange) onChange();
        }, 2000);
        return () => clearTimeout(timeout);
    }, [nodes, edges, isLoaded]);

    const handleManualSave = async () => {
        setSaveStatus('saving');
        try {
            await saveToDb(nodes, edges);
            const timestamp = new Date().toISOString();
            await fetch(`${SERVER_URL}/flow/version`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
                body: JSON.stringify({ sessionId, value: { nodes, edges, timestamp }, timestamp })
            });
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (e) {
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 3000);
        }
    };

    // Interaction Handlers
    const onPaneClick = useCallback((event: React.MouseEvent) => {
        if (currentTool === 'sticky' || currentTool === 'shape' || currentTool === 'text') {
            const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
            const id = crypto.randomUUID();
            
            let newNode: Node;
            if (currentTool === 'sticky') {
                newNode = { id, type: 'sticky', position, data: { label: '', color: '#fff740' } };
            } else if (currentTool === 'shape') {
                newNode = { id, type: 'shape', position, data: { label: '', color: '#ffffff', shape: 'rectangle' } };
            } else {
                newNode = { id, type: 'text', position, data: { label: 'Text' } };
            }
            
            // Center node on click
            if (currentTool !== 'text') {
                newNode.position = { x: newNode.position.x - 75, y: newNode.position.y - 75 };
            }
            
            setNodes((nds) => [...nds, newNode]);
        }
    }, [currentTool, screenToFlowPosition, setNodes]);

    return (
        <div className="h-full w-full relative bg-[#f8f9fa] cursor-default" style={{ width: '100%', height: '100%' }}>
            <ReactFlow
                defaultNodes={[]}
                defaultEdges={[]}
                // nodes/edges managed via useNodes/useEdges hooks in uncontrolled mode
                onConnect={onConnect}
                onPaneClick={onPaneClick}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                connectionMode={ConnectionMode.Loose}
                panOnDrag={currentTool === 'hand' || (currentTool === 'select' && false)} // Hand: pan. Select: box select (so pan=false).
                selectionOnDrag={currentTool === 'select'}
                panOnScroll={true}
                selectionMode={currentTool === 'select' ? undefined : undefined} 
                defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                minZoom={0.1}
                maxZoom={4}
                fitView
            >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e7eb" />
                <Controls showInteractive={false} className="!bg-white !border-slate-200 !shadow-lg !rounded-lg" />
                
                <FlowToolbar 
                    currentTool={currentTool} 
                    setTool={setCurrentTool} 
                    onSave={handleManualSave}
                    saveStatus={saveStatus}
                    isLoaded={isLoaded}
                />
            </ReactFlow>
            
            <style>{`
                .react-flow__pane {
                    cursor: ${currentTool === 'hand' ? 'grab' : 
                              currentTool === 'select' ? 'default' : 
                              'crosshair'} !important;
                }
                .react-flow__pane:active {
                    cursor: ${currentTool === 'hand' ? 'grabbing' : 
                              currentTool === 'select' ? 'default' : 
                              'crosshair'} !important;
                }
            `}</style>
        </div>
    );
});

export const FlowEditor = forwardRef<IPane, any>((props, ref) => {
    return (
        <ReactFlowProvider>
            <FlowCanvas {...props} ref={ref} />
        </ReactFlowProvider>
    );
});
