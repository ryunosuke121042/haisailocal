// haisailocal のロゴ。朝日の色の地球に軌道が一周し、日本の位置にピンが立つ（世界から地元の一軒へ）。
// onLight：白い背景の上では、軌道とピンを濃紺にする
import { useId } from 'react';
import '@fontsource/outfit/300.css';
import '@fontsource/outfit/700.css';

export function LogoMark({ size = 48, onLight = false, className }: { size?: number; onLight?: boolean; className?: string }) {
  const id = useId().replace(/:/g, '');
  const ink = onLight ? '#121a30' : '#ffffff';
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="haisailocal">
      <defs>
        <linearGradient id={`${id}g`} x1="0.1" y1="0.05" x2="0.9" y2="0.95">
          <stop offset="0" stopColor="#ffc15e" />
          <stop offset="0.5" stopColor="#ff7f62" />
          <stop offset="1" stopColor="#ff4f8b" />
        </linearGradient>
        <radialGradient id={`${id}s`} cx="0.34" cy="0.28" r="0.75">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}c`}>
          <circle cx="32" cy="34" r="20" />
        </clipPath>
      </defs>
      {/* 軌道の奥側（地球の後ろを通る） */}
      <path className="logo-orbit" d="M5.5 41.5 C 4 33, 30 22, 52 21.5 C 61 21.3, 62 25.5, 58.5 28.5" fill="none" stroke={ink} strokeOpacity="0.45" strokeWidth="2.2" strokeLinecap="round" />
      {/* 地球 */}
      <circle cx="32" cy="34" r="20" fill={`url(#${id}g)`} />
      <g clipPath={`url(#${id}c)`} fill="none" stroke="#fff" strokeOpacity="0.32" strokeWidth="1.3">
        <path d="M10 30 Q32 38 54 30" />
        <path d="M11 41 Q32 49 53 41" />
        <path d="M32 12 Q22 34 32 56" />
        <path d="M32 12 Q42 34 32 56" />
      </g>
      <circle cx="32" cy="34" r="20" fill={`url(#${id}s)`} />
      {/* 軌道の手前側 */}
      <path className="logo-orbit logo-orbit-front" d="M58.5 28.5 C 54 33, 34 41, 16 44 C 8.5 45.3, 5 44, 5.5 41.5" fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
      {/* 日本の位置に立つピン */}
      <g className="logo-pin" transform="translate(41 13.5)">
        <path d="M0 -10.5 C 6 -10.5 9.5 -6.4 9.5 -1.6 C 9.5 4.6 0 12.5 0 12.5 C 0 12.5 -9.5 4.6 -9.5 -1.6 C -9.5 -6.4 -6 -10.5 0 -10.5 Z" fill={ink} />
        <circle cx="0" cy="-1.8" r="3.6" fill={`url(#${id}g)`} />
      </g>
    </svg>
  );
}

/** 文字のロゴ：「haisai」を太く、「local」を朝日のグラデーションで */
export function Wordmark({ onLight = false, className }: { onLight?: boolean; className?: string }) {
  return (
    <span className={`wordmark ${onLight ? 'wordmark-on-light' : ''} ${className ?? ''}`}>
      <span className="wordmark-a">haisai</span>
      <span className="wordmark-b">local</span>
    </span>
  );
}

/**
 * 文字のロゴを SVG で描いたもの（オープニング用）。どの大きさでもにじまず、
 * 細い縁どり（文字の下に敷く線）で、明るい空の上でも読みやすい。CSS の影やぼかしは使わない
 */
export function WordmarkSvg({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className={className} viewBox="0 0 500 98" role="img" aria-label="haisailocal">
      <defs>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffe0a8" />
          <stop offset="0.45" stopColor="#ffab84" />
          <stop offset="1" stopColor="#ff7aa8" />
        </linearGradient>
      </defs>
      <text x="10" y="84" fontFamily="Outfit, system-ui, sans-serif" fontSize="100" letterSpacing="-1" stroke="rgb(10 14 30 / 0.55)" strokeWidth="4" strokeLinejoin="round" paintOrder="stroke">
        <tspan fontWeight="700" fill="#ffffff">
          haisai
        </tspan>
        <tspan fontWeight="300" fill={`url(#${id}w)`}>
          local
        </tspan>
      </text>
    </svg>
  );
}

export function Logo({ size = 44, onLight = false }: { size?: number; onLight?: boolean }) {
  return (
    <span className="logo">
      <LogoMark size={size} onLight={onLight} />
      <Wordmark onLight={onLight} />
    </span>
  );
}
