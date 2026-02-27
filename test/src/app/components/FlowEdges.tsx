import { useCallback } from 'react';
import { useStore, getBezierPath, EdgeProps, getSmoothStepPath } from 'reactflow';
import { getEdgeParams } from './flowUtils';

function SimpleFloatingEdge({ id, source, target, markerEnd, style }: EdgeProps) {
  const sourceNode = useStore(useCallback((store) => store.nodeInternals.get(source), [source]));
  const targetNode = useStore(useCallback((store) => store.nodeInternals.get(target), [target]));

  if (!sourceNode || !targetNode) {
    return null;
  }

  const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(sourceNode, targetNode);

  const [edgePath] = getSmoothStepPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: sourcePos,
    targetPosition: targetPos,
    targetX: tx,
    targetY: ty,
    borderRadius: 20, // Rounded corners like FigJam
  });

  return (
    <path
      id={id}
      className="react-flow__edge-path"
      d={edgePath}
      markerEnd={markerEnd}
      style={style}
    />
  );
}

export default SimpleFloatingEdge;
