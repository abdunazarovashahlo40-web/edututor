/**
 * Interaktiv doska (whiteboard): video dars ichida o'qituvchi va o'quvchi birga chizadi.
 * Koordinatalar 0..1 oralig'ida yuboriladi — har xil ekran o'lchamida ham bir xil ko'rinadi.
 * Chizish jonli: chiziq bo'laklari ~80 ms da bir yuboriladi.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Eraser, Pen, Trash2, X } from 'lucide-react';
import { connectSocket } from '../../services/socket';
import { useI18n } from '../../i18n';
import { cn } from '../../utils/cn';

type Stroke = { id: string; color: string; size: number; erase: boolean; points: [number, number][] };

const COLORS = ['#111827', '#7C3AED', '#2563EB', '#DC2626', '#16A34A'];
const BG = '#FFFFFF';

export function Whiteboard({ isTeacher, onClose }: { isTeacher: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const drawing = useRef<{ id: string; pending: [number, number][]; last: [number, number] | null } | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [erase, setErase] = useState(false);
  const [size, setSize] = useState(3);

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, s: Stroke, w: number, h: number) => {
    if (!s.points.length) return;
    ctx.strokeStyle = s.erase ? BG : s.color;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = (s.erase ? s.size * 4 : s.size) * (w / 1000) * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (s.points.length === 1) {
      ctx.beginPath();
      ctx.arc(s.points[0][0] * w, s.points[0][1] * h, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(s.points[0][0] * w, s.points[0][1] * h);
    for (const [x, y] of s.points.slice(1)) ctx.lineTo(x * w, y * h);
    ctx.stroke();
  }, []);

  const redraw = useCallback(() => {
    const c = canvasRef.current;
    const wrap = wrapRef.current;
    if (!c || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = wrap.getBoundingClientRect();
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    c.style.width = `${width}px`;
    c.style.height = `${height}px`;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, width, height);
    for (const s of strokes.current) drawStroke(ctx, s, width, height);
  }, [drawStroke]);

  const paint = useCallback(
    (s: Stroke) => {
      const c = canvasRef.current;
      const wrap = wrapRef.current;
      if (!c || !wrap) return;
      const { width, height } = wrap.getBoundingClientRect();
      drawStroke(c.getContext('2d')!, s, width, height);
    },
    [drawStroke],
  );

  // Holatni olish va jonli yangilanishlar
  useEffect(() => {
    const s = connectSocket();
    s.emit('wb:state', (r: { strokes: Stroke[] }) => {
      strokes.current = r?.strokes ?? [];
      redraw();
    });
    const onStroke = (st: Stroke) => {
      strokes.current.push(st);
      paint(st);
    };
    const onClear = () => {
      strokes.current = [];
      redraw();
    };
    s.on('wb:stroke', onStroke);
    s.on('wb:clear', onClear);
    const ro = new ResizeObserver(() => redraw());
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => {
      s.off('wb:stroke', onStroke);
      s.off('wb:clear', onClear);
      ro.disconnect();
    };
  }, [paint, redraw]);

  // Chiziq bo'laklarini muntazam yuborish
  useEffect(() => {
    const id = window.setInterval(() => flush(), 80);
    return () => window.clearInterval(id);
  });

  const flush = () => {
    const d = drawing.current;
    if (!d || !d.pending.length) return;
    const points: [number, number][] = d.last ? [d.last, ...d.pending] : [...d.pending];
    const st: Stroke = { id: d.id, color, size, erase, points };
    connectSocket().emit('wb:stroke', st);
    strokes.current.push(st);
    d.last = d.pending[d.pending.length - 1];
    d.pending = [];
  };

  const pos = (e: React.PointerEvent): [number, number] => {
    const r = wrapRef.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = pos(e);
    drawing.current = { id: Math.random().toString(36).slice(2, 10), pending: [p], last: null };
    paint({ id: '', color, size, erase, points: [p] });
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drawing.current;
    if (!d) return;
    const p = pos(e);
    const prev = d.pending[d.pending.length - 1] ?? d.last;
    if (prev) paint({ id: '', color, size, erase, points: [prev, p] });
    d.pending.push(p);
  };
  const onUp = () => {
    flush();
    drawing.current = null;
  };

  return (
    <div className="absolute inset-0 z-[15] flex flex-col overflow-hidden rounded-3xl bg-white text-ink shadow-2xl">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <span className="mr-1 text-sm font-extrabold">{t('room.whiteboard')}</span>
        <button
          onClick={() => setErase(false)}
          className={cn('grid h-9 w-9 place-items-center rounded-xl', !erase ? 'bg-brand-600 text-white' : 'hover:bg-slate-100')}
          aria-label={t('room.pen')}
          title={t('room.pen')}
        >
          <Pen className="h-4 w-4" />
        </button>
        <button
          onClick={() => setErase(true)}
          className={cn('grid h-9 w-9 place-items-center rounded-xl', erase ? 'bg-brand-600 text-white' : 'hover:bg-slate-100')}
          aria-label={t('room.eraser')}
          title={t('room.eraser')}
        >
          <Eraser className="h-4 w-4" />
        </button>
        <div className="mx-1 flex items-center gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setColor(c);
                setErase(false);
              }}
              className={cn('h-6 w-6 rounded-full ring-offset-2 transition', color === c && !erase && 'ring-2 ring-brand-500')}
              style={{ background: c }}
              aria-label={c}
            />
          ))}
        </div>
        <select value={size} onChange={(e) => setSize(Number(e.target.value))} className="h-9 rounded-xl border border-line px-2 text-sm" aria-label={t('room.thickness')}>
          <option value={2}>S</option>
          <option value={3}>M</option>
          <option value={6}>L</option>
        </select>
        <div className="ml-auto flex items-center gap-1">
          {isTeacher && (
            <button onClick={() => connectSocket().emit('wb:clear')} className="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-sm font-bold text-danger hover:bg-red-50">
              <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">{t('room.clearBoard')}</span>
            </button>
          )}
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl hover:bg-slate-100" aria-label={t('common.close')}>
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div ref={wrapRef} className="relative flex-1 touch-none">
        <canvas
          ref={canvasRef}
          className={cn('absolute inset-0', erase ? 'cursor-cell' : 'cursor-crosshair')}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
      </div>
    </div>
  );
}
