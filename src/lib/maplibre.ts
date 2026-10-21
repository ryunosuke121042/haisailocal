// MapLibre を配布ファイルのまま読み込む（locamap と同じ方式）。
// v5 は UMD 形式で、本番ビルド（Rollup）で変換するとワーカーとのやりとりが壊れ、
// エラーも出さずに地図が描かれなくなる。変換せずに <script> で読み込み、ワーカーも別ファイルのまま使う。
import libraryUrl from 'maplibre-gl/dist/maplibre-gl-csp.js?url';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-csp-worker.js?url';
import 'maplibre-gl/dist/maplibre-gl.css';

export type MapLibre = typeof import('maplibre-gl');

declare global {
  interface Window {
    maplibregl?: MapLibre;
  }
}

let loading: Promise<MapLibre> | null = null;

export function loadMaplibre(): Promise<MapLibre> {
  loading ??= new Promise((resolve, reject) => {
    const ready = () => {
      const lib = window.maplibregl!;
      lib.setWorkerUrl(workerUrl);
      resolve(lib);
    };
    if (window.maplibregl) return ready();
    const script = document.createElement('script');
    script.src = libraryUrl;
    script.async = true;
    script.onload = ready;
    script.onerror = () => {
      loading = null; // 次に呼ばれたときに読み込み直せるようにする
      reject(new Error('maplibre_load_failed'));
    };
    document.head.appendChild(script);
  });
  return loading;
}
