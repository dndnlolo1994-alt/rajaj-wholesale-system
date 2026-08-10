'use client';

import { useState } from 'react';
import { formatJOD, formatJODCompact } from '@/lib/calc/money';

interface Datum {
  label: string;
  value: number;
  hint?: string;
}

/**
 * رسم أعمدة SVG خفيف — بدون مكتبات خارجية.
 * محور واحد، أعمدة رفيعة بنهايات مدوّرة مثبتة على خط الأساس،
 * شبكة خافتة، Tooltip عند المرور، وتسمية مباشرة لأعلى قيمة.
 * المحور الزمني يبقى LTR (الأقدم يسارًا) وهو العرف في الرسوم البيانية.
 */
export function BarChart({
  data,
  color = '#0e8a5e',
  height = 180,
  money = true,
}: {
  data: Datum[];
  color?: string;
  height?: number;
  money?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 640;
  const H = height;
  const padTop = 18;
  const padBottom = 26;
  const padX = 8;
  const plotH = H - padTop - padBottom;
  const n = Math.max(data.length, 1);
  const step = (W - padX * 2) / n;
  const barW = Math.min(38, Math.max(10, step * 0.55));

  const max = Math.max(...data.map((d) => d.value), 0.001);
  const niceMax = niceCeil(max);
  const ticks = [0, niceMax / 2, niceMax];
  const maxIndex = data.reduce((mi, d, i) => (d.value > data[mi].value ? i : mi), 0);

  const y = (v: number) => padTop + plotH - (v / niceMax) * plotH;

  return (
    <div dir="ltr" className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
        {/* شبكة خافتة */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padX} x2={W - padX} y1={y(t)} y2={y(t)} stroke="#e4e7ec" strokeWidth={t === 0 ? 1.5 : 1} strokeDasharray={t === 0 ? undefined : '3 4'} />
            <text x={W - padX} y={y(t) - 4} textAnchor="end" fontSize={10} fill="#98a2b3" className="tnum">
              {money ? formatJODCompact(t) : Math.round(t)}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const cx = padX + step * i + step / 2;
          const barH = Math.max(2, (d.value / niceMax) * plotH);
          const yTop = padTop + plotH - barH;
          const active = hover === i;
          return (
            <g key={i}>
              {/* هدف لمس أوسع من العمود */}
              <rect
                x={padX + step * i}
                y={padTop}
                width={step}
                height={plotH + padBottom}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onTouchStart={() => setHover(i)}
              />
              <path
                d={roundedTopBar(cx - barW / 2, yTop, barW, barH, 4)}
                fill={color}
                opacity={hover === null || active ? 1 : 0.45}
                style={{ transition: 'opacity 0.12s' }}
                pointerEvents="none"
              />
              {/* تسمية مباشرة لأعلى قيمة فقط */}
              {i === maxIndex && d.value > 0 && hover === null ? (
                <text x={cx} y={yTop - 5} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#344054" className="tnum">
                  {money ? formatJODCompact(d.value) : d.value}
                </text>
              ) : null}
              <text x={cx} y={H - 8} textAnchor="middle" fontSize={10.5} fill={active ? '#101828' : '#98a2b3'} fontWeight={active ? 700 : 500}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      {hover !== null && data[hover] ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg bg-ink-900 px-2.5 py-1.5 text-center shadow-pop"
          style={{
            left: `${((padX + step * hover + step / 2) / W) * 100}%`,
            top: 0,
          }}
        >
          <p className="whitespace-nowrap text-[10px] font-bold text-ink-300">{data[hover].hint ?? data[hover].label}</p>
          <p dir="ltr" className="tnum whitespace-nowrap text-xs font-extrabold text-white">
            {money ? formatJOD(data[hover].value) : data[hover].value}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function roundedTopBar(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.min(r, w / 2, h);
  return [
    `M ${x} ${y + h}`,
    `L ${x} ${y + radius}`,
    `Q ${x} ${y} ${x + radius} ${y}`,
    `L ${x + w - radius} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + radius}`,
    `L ${x + w} ${y + h}`,
    'Z',
  ].join(' ');
}

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const unit = v / pow;
  const nice = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10;
  return nice * pow;
}
