import { useRef, useState } from 'react';

export interface ImageViewerState {
  src: string;
  title: string;
}

export function useImageViewer() {
  const [imageViewer, setImageViewer] = useState<ImageViewerState | null>(null);
  const [viewerScale, setViewerScale] = useState(1);
  const [viewerOffset, setViewerOffset] = useState({ x: 0, y: 0 });
  const [viewerDragging, setViewerDragging] = useState(false);
  const viewerDraggingRef = useRef(false);
  const viewerDragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const viewerOffsetStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const resetViewerTransform = () => {
    setViewerScale(1);
    setViewerOffset({ x: 0, y: 0 });
  };

  const openImageViewer = (b64: string, title: string) => {
    setImageViewer({ src: `data:image/jpeg;base64,${b64}`, title });
    resetViewerTransform();
  };

  const stopViewerDrag = () => {
    viewerDraggingRef.current = false;
    setViewerDragging(false);
  };

  const closeImageViewer = () => {
    setImageViewer(null);
    stopViewerDrag();
  };

  const onViewerWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY;
    const factor = delta > 0 ? 0.9 : 1.1;
    setViewerScale((prev) => Math.min(5, Math.max(0.2, prev * factor)));
  };

  const onViewerMouseDown = (e: React.MouseEvent) => {
    viewerDraggingRef.current = true;
    setViewerDragging(true);
    viewerDragStartRef.current = { x: e.clientX, y: e.clientY };
    viewerOffsetStartRef.current = { ...viewerOffset };
  };

  const onViewerMouseMove = (e: React.MouseEvent) => {
    if (!viewerDraggingRef.current) return;
    const dx = e.clientX - viewerDragStartRef.current.x;
    const dy = e.clientY - viewerDragStartRef.current.y;
    setViewerOffset({ x: viewerOffsetStartRef.current.x + dx, y: viewerOffsetStartRef.current.y + dy });
  };

  return {
    imageViewer,
    viewerScale,
    viewerOffset,
    viewerDragging,
    openImageViewer,
    closeImageViewer,
    resetViewerTransform,
    setViewerScale,
    onViewerWheel,
    onViewerMouseDown,
    onViewerMouseMove,
    stopViewerDrag,
  };
}
