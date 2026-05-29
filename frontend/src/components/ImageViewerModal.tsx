import { ZoomIn, ZoomOut, XCircle } from 'lucide-react';

interface ImageViewerModalProps {
  title: string;
  src: string;
  scale: number;
  offset: { x: number; y: number };
  dragging: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onClose: () => void;
  onWheel: (e: React.WheelEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
}

export default function ImageViewerModal({
  title,
  src,
  scale,
  offset,
  dragging,
  onZoomIn,
  onZoomOut,
  onReset,
  onClose,
  onWheel,
  onMouseDown,
  onMouseMove,
  onMouseUp,
}: ImageViewerModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-3">
        <div className="text-sm text-zinc-200 font-medium truncate">{title}</div>
        <div className="flex items-center gap-2">
          <button
            onClick={onZoomIn}
            className="p-2 rounded-xl border border-white/15 bg-white/10 text-white hover:bg-white/15"
            title="放大"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={onZoomOut}
            className="p-2 rounded-xl border border-white/15 bg-white/10 text-white hover:bg-white/15"
            title="缩小"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={onReset}
            className="px-3 py-2 rounded-xl border border-white/15 bg-white/10 text-[12px] text-white hover:bg-white/15"
            title="重置"
          >
            重置
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-xl border border-white/15 bg-white/10 text-white hover:bg-white/15"
            title="关闭"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div
        className="w-full h-full pt-16 pb-6 px-6"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <div className="w-full h-full overflow-hidden rounded-2xl border border-white/10 bg-black/40">
          <div className="w-full h-full flex items-center justify-center">
            <img
              src={src}
              className="select-none"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                transformOrigin: 'center',
                maxWidth: 'none',
                maxHeight: 'none',
                cursor: dragging ? 'grabbing' : 'grab',
              }}
              draggable={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
