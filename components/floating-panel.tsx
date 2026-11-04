'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent,
  type KeyboardEvent,
} from 'react';
import { GripHorizontal, X } from 'lucide-react';

type Position = { x: number; y: number };
export function FloatingPanel({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const id = useId();
  const element = useRef<HTMLElement>(null);
  const drag = useRef<{ pointer: number; dx: number; dy: number } | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const clamp = (p: Position) => {
    const box = element.current?.getBoundingClientRect();
    const host = element.current?.parentElement?.getBoundingClientRect();
    return {
      x: Math.max(
        8,
        Math.min(
          p.x,
          (host?.width ?? window.innerWidth) - (box?.width ?? 300) - 8,
        ),
      ),
      y: Math.max(
        8,
        Math.min(
          p.y,
          (host?.height ?? window.innerHeight) - (box?.height ?? 300) - 8,
        ),
      ),
    };
  };
  useEffect(() => {
    const observer = new ResizeObserver(() =>
      setPosition((p) => (p ? clamp(p) : p)),
    );
    if (element.current) observer.observe(element.current);
    if (element.current?.parentElement)
      observer.observe(element.current.parentElement);
    return () => observer.disconnect();
  }, []);
  const start = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const box = element.current!.getBoundingClientRect(),
      host = element.current!.parentElement!.getBoundingClientRect();
    drag.current = {
      pointer: event.pointerId,
      dx: event.clientX - box.left,
      dy: event.clientY - box.top,
    };
    setPosition({ x: box.left - host.left, y: box.top - host.top });
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    if (drag.current?.pointer !== event.pointerId) return;
    const host = element.current!.parentElement!.getBoundingClientRect();
    setPosition(
      clamp({
        x: event.clientX - host.left - drag.current.dx,
        y: event.clientY - host.top - drag.current.dy,
      }),
    );
  };
  const keyboard = (event: KeyboardEvent) => {
    if (
      !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
    )
      return;
    event.preventDefault();
    const box = element.current!.getBoundingClientRect(),
      host = element.current!.parentElement!.getBoundingClientRect();
    const step = event.shiftKey ? 40 : 10;
    setPosition(
      clamp({
        x:
          box.left -
          host.left +
          (event.key === 'ArrowRight'
            ? step
            : event.key === 'ArrowLeft'
              ? -step
              : 0),
        y:
          box.top -
          host.top +
          (event.key === 'ArrowDown'
            ? step
            : event.key === 'ArrowUp'
              ? -step
              : 0),
      }),
    );
  };
  return (
    <aside
      ref={element}
      className="floating-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby={id}
      style={
        position
          ? { left: position.x, top: position.y, right: 'auto' }
          : undefined
      }
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="floating-panel-header">
        <button
          className="floating-panel-grip"
          aria-label={'Mover panel ' + title}
          title="Arrastra para mover · flechas con el teclado"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onKeyDown={keyboard}
        >
          <GripHorizontal />
          <span id={id}>{title}</span>
        </button>
        <button
          className="floating-panel-close"
          aria-label="Cerrar panel"
          onClick={onClose}
        >
          <X />
        </button>
      </header>
      <div className="floating-panel-body">{children}</div>
    </aside>
  );
}
