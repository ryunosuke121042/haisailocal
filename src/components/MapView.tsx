import { useEffect, useRef } from 'react';
import type { FeatureCollection, Point } from 'geojson';
import type { ExpressionSpecification, FilterSpecification, GeoJSONSource, Map as MlMap, MapLayerMouseEvent, Marker } from 'maplibre-gl';
import type { Lang } from '../../shared/constants';
import { loadMaplibre, type MapLibre } from '../lib/maplibre';

export interface Pin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  symbol?: string;
}

interface LatLng {
  lat: number;
  lng: number;
}

// 地図の見た目と操作は locamap の地図と同じ仕様にそろえている

// 関西全体が見える位置から始める（店があればすぐ店の位置に合わせる）
const INITIAL_CENTER: [number, number] = [135.55, 34.82]; // [lng, lat]
const INITIAL_ZOOM = 8;
const PIN_ZOOM = 15;

// 地名を表示言語で描けるようベクタータイルを使う（OpenFreeMap：APIキー不要）
// Positron は 3D の建物や地形の陰影がない軽量でシンプルなスタイル
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';

// 表示言語の名前がない地名は、読める可能性の高い順に代わりの名前を使う
const LABEL_FIELDS: Record<Lang, string[]> = {
  en: ['name:en', 'name_en', 'name:latin', 'name'],
  ja: ['name:ja', 'name'],
  zh: ['name:zh', 'name:ja', 'name'],
  ko: ['name:ko', 'name:en', 'name:latin', 'name'],
  fr: ['name:fr', 'name:en', 'name:latin', 'name'],
  es: ['name:es', 'name:en', 'name:latin', 'name'],
};

const PIN_COLOR = '#3f6f4c';
const SELECTED_COLOR = '#b3412e';
const NO_SELECTION = '';
const DEFAULT_SYMBOL = '●';

// スタイルの読み込み後に呼ぶ（データの読み込み中も isStyleLoaded() は false になるため判定には使わない）
function applyLabelLanguage(map: MlMap, lang: Lang) {
  const textField = ['coalesce', ...LABEL_FIELDS[lang].map((f) => ['get', f])] as ExpressionSpecification;
  for (const layer of map.getStyle().layers) {
    const current = (layer as { layout?: Record<string, unknown> }).layout?.['text-field'];
    // 道路番号（ref）やクラスターの件数など、名前以外のラベルはそのまま
    if (current && JSON.stringify(current).includes('"name')) {
      map.setLayoutProperty(layer.id, 'text-field', textField);
    }
  }
}

// 丸い枠に記号を描いたマーカー画像（地図と一緒に GPU で描画する）
function markerImage(symbol: string, color: string, size: number) {
  const ratio = 2;
  const pad = 4; // 影の分の余白
  const full = (size + pad * 2) * ratio;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = full;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(ratio, ratio);
  const c = size / 2 + pad;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.arc(c, c, size / 2 - 1.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.font = `800 ${Math.round(size / 2)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","M PLUS Rounded 1c",sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, c, c + 1);
  return { image: ctx.getImageData(0, 0, full, full), options: { pixelRatio: ratio } };
}

const iconId = (symbol: string) => `pin-${encodeURIComponent(symbol)}`;

// 記号ごとの画像を、まだなければ作る（通常と選択中の 2 種類）
function ensureMarkerImages(map: MlMap, pins: Pin[]) {
  for (const symbol of new Set(pins.map((p) => p.symbol || DEFAULT_SYMBOL))) {
    const id = iconId(symbol);
    if (map.hasImage(id)) continue;
    const normal = markerImage(symbol, PIN_COLOR, 36);
    const selected = markerImage(symbol, SELECTED_COLOR, 47);
    map.addImage(id, normal.image, normal.options);
    map.addImage(`${id}-selected`, selected.image, selected.options);
  }
}

// 目印になる駅・空港・名所の名前を地図に重ねる（地図データに含まれるズームから表示される）
// text-field に "name" を使うので、地名と同じく applyLabelLanguage で表示言語に切り替わる
const LANDMARK_CLASSES = ['attraction', 'castle', 'museum', 'monument', 'zoo', 'aquarium', 'theme_park', 'place_of_worship', 'viewpoint'];
const STATION_FILTER = ['all', ['==', ['get', 'class'], 'railway'], ['match', ['get', 'subclass'], ['station', 'subway'], true, false]] as FilterSpecification;
const landmarkFilter = (maxRank: number) =>
  ['all', ['match', ['get', 'class'], LANDMARK_CLASSES, true, false], ['<=', ['coalesce', ['get', 'rank'], 99], maxRank]] as FilterSpecification;
const LABEL_HALO = { 'text-halo-color': 'rgba(255, 255, 255, 0.95)', 'text-halo-width': 1.6 };

// 「〇〇5丁目」のような細かい町名は目印にならないので出さない。
// 市区町村より細かい地名のうち、区・地区レベル（suburb）と島の名前だけ残す
// 「兵庫南91号線」のような細い道路の名前も同じ理由で出さない（幹線道路の名前は残す）
function hideMinorPlaceLabels(map: MlMap) {
  if (map.getLayer('label_other')) {
    map.setFilter('label_other', ['match', ['get', 'class'], ['suburb', 'island'], true, false]);
  }
  for (const id of ['highway-name-minor', 'highway-name-path']) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
  }
  // 日本の地図データでは地元の道路も「主要道路」に分類されていることが多いので、国道クラスだけ名前を出す
  if (map.getLayer('highway-name-major')) {
    map.setFilter('highway-name-major', ['match', ['get', 'class'], ['primary', 'trunk'], true, false]);
  }
}

function addLandmarkLayers(map: MlMap, beforeId: string) {
  const dot = (id: string, filter: FilterSpecification, minzoom: number, color: string, sourceLayer = 'poi') =>
    map.addLayer(
      {
        id,
        type: 'circle',
        source: 'openmaptiles',
        'source-layer': sourceLayer,
        minzoom,
        filter,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], minzoom, 3, 16, 4.5],
          'circle-color': color,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
        },
      },
      beforeId,
    );
  const label = (
    id: string,
    filter: FilterSpecification,
    minzoom: number,
    { color, font, size, sourceLayer = 'poi' }: { color: string; font: string; size: number; sourceLayer?: string },
  ) =>
    map.addLayer(
      {
        id,
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': sourceLayer,
        minzoom,
        filter,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': [font],
          'text-size': ['interpolate', ['linear'], ['zoom'], minzoom, size, 17, size + 2],
          'text-anchor': 'top',
          'text-offset': [0, 0.6],
          'text-max-width': 8,
          // 重要度の高いものを優先して残す
          'symbol-sort-key': ['coalesce', ['get', 'rank'], 99],
        },
        paint: { 'text-color': color, ...LABEL_HALO },
      },
      beforeId,
    );

  const hasName = ['has', 'name'] as FilterSpecification;
  const moreFilter = ['all', landmarkFilter(10), ['>', ['coalesce', ['get', 'rank'], 99], 3]] as FilterSpecification;
  // 空港
  dot('lm-airport-dot', hasName, 9, '#4a5d8a', 'aerodrome_label');
  label('lm-airport', hasName, 9, { color: '#33456e', font: 'Noto Sans Bold', size: 12, sourceLayer: 'aerodrome_label' });
  // 駅
  dot('lm-station-dot', STATION_FILTER, 12, '#3d4a44');
  label('lm-station', STATION_FILTER, 12, { color: '#2b332f', font: 'Noto Sans Bold', size: 11 });
  // 名所：はじめは特に主要なものだけ、拡大すると増やす
  dot('lm-place-dot', landmarkFilter(3), 14, '#8a5a2b');
  label('lm-place', landmarkFilter(3), 14, { color: '#6b4420', font: 'Noto Sans Italic', size: 11 });
  dot('lm-place-more-dot', moreFilter, 15.5, '#8a5a2b');
  label('lm-place-more', moreFilter, 15.5, { color: '#6b4420', font: 'Noto Sans Italic', size: 11 });
}

function toGeoJSON(pins: Pin[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: pins.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { id: p.id, icon: iconId(p.symbol || DEFAULT_SYMBOL) },
    })),
  };
}

const userPoint = (here: LatLng): Point => ({ type: 'Point', coordinates: [here.lng, here.lat] });

const notCluster: ExpressionSpecification = ['!', ['has', 'point_count']];
const pinFilter = (selectedId?: string) => ['all', notCluster, ['!=', ['get', 'id'], selectedId ?? NO_SELECTION]] as FilterSpecification;
const selectedFilter = (selectedId?: string) => ['all', notCluster, ['==', ['get', 'id'], selectedId ?? NO_SELECTION]] as FilterSpecification;

function addPinLayers(map: MlMap, selectedId?: string) {
  // 重なったマーカーはまとめて件数を表示し、拡大すると個別に表示する
  map.addSource('pins', {
    type: 'geojson',
    data: toGeoJSON([]),
    cluster: true,
    clusterRadius: 50,
    clusterMaxZoom: 15,
  });
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'pins',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': ['step', ['get', 'point_count'], '#6fae8a', 10, '#2f6b4f', 50, '#1f4a36'],
      'circle-radius': ['step', ['get', 'point_count'], 18, 10, 22, 50, 27],
      'circle-stroke-width': 4,
      'circle-stroke-color': 'rgba(255, 255, 255, 0.85)',
    },
  });
  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'pins',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 13,
      'text-allow-overlap': true,
    },
    paint: { 'text-color': '#ffffff' },
  });
  const iconLayout = (suffix: string) => ({
    'icon-image': ['concat', ['get', 'icon'], suffix] as ExpressionSpecification,
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  });
  map.addLayer({ id: 'pins', type: 'symbol', source: 'pins', filter: pinFilter(selectedId), layout: iconLayout('') });
  map.addLayer({ id: 'pin-selected', type: 'symbol', source: 'pins', filter: selectedFilter(selectedId), layout: iconLayout('-selected') });

  map.addSource('user-location', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer(
    {
      id: 'user-location',
      type: 'circle',
      source: 'user-location',
      paint: {
        'circle-radius': 8,
        'circle-color': '#2a7de1',
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
      },
    },
    'clusters',
  );
}

interface State {
  pins: Pin[];
  selectedId?: string;
  userLocation?: LatLng;
  lang: Lang;
  draggable?: boolean;
  center?: LatLng;
  onSelect?: (id: string) => void;
  onDrag?: (lat: number, lng: number) => void;
}

// 店の位置に地図を合わせる（指定の中心 → 1 件ならその店 → 複数なら全体が入る範囲）
function frame(map: MlMap, lib: MapLibre, { pins, center }: State, animate: boolean) {
  const target = center ?? (pins.length === 1 ? pins[0] : null);
  if (target) {
    const camera = { center: [target.lng, target.lat] as [number, number], zoom: PIN_ZOOM };
    if (animate) map.easeTo(camera);
    else map.jumpTo(camera);
  } else if (pins.length > 1) {
    const bounds = new lib.LngLatBounds();
    for (const p of pins) bounds.extend([p.lng, p.lat]);
    map.fitBounds(bounds, { padding: 60, maxZoom: 14, animate });
  }
}

// ピンを描き直す。位置の編集中は、ドラッグできる普通のマーカーで描く
function showPins(map: MlMap, lib: MapLibre, dragMarkers: Marker[], latest: { current: State }) {
  const { pins, draggable } = latest.current;
  for (const m of dragMarkers.splice(0)) m.remove();
  if (draggable) {
    (map.getSource('pins') as GeoJSONSource).setData(toGeoJSON([]));
    for (const p of pins) {
      const marker = new lib.Marker({ draggable: true, color: PIN_COLOR }).setLngLat([p.lng, p.lat]).addTo(map);
      marker.getElement().title = p.label;
      marker.on('dragend', () => {
        const { lat, lng } = marker.getLngLat();
        latest.current.onDrag?.(lat, lng);
      });
      dragMarkers.push(marker);
    }
  } else {
    ensureMarkerImages(map, pins);
    (map.getSource('pins') as GeoJSONSource).setData(toGeoJSON(pins));
  }
}

// 地図を作り、ピンのレイヤーと操作のイベントを設定する（latest には常に最新の props が入っている）
function createMap(lib: MapLibre, container: HTMLElement, latest: { current: State }, onReady: () => void) {
  const map = new lib.Map({
    container,
    style: MAP_STYLE,
    center: INITIAL_CENTER,
    zoom: INITIAL_ZOOM,
    minZoom: 4,
    maxZoom: 17,
    // 高解像度の画面でも描画は 2 倍までにして負荷を抑える
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    // 回転・傾きは使わない（操作をシンプルにし描画も軽くする）
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    maxPitch: 0,
    renderWorldCopies: false,
    attributionControl: { compact: true },
  });
  map.touchZoomRotate.disableRotation();
  map.keyboard.disableRotation();
  map.addControl(new lib.NavigationControl({ showCompass: false }), 'bottom-right');
  frame(map, lib, latest.current, false);

  // 'load' は最初の画面の地図タイルがすべて届くまで待つため、スタイルの読み込み直後にピンと地名を準備する
  map.once('style.load', () => {
    const { selectedId, userLocation, lang } = latest.current;
    addPinLayers(map, selectedId);
    // ピン・現在地より下に描く
    addLandmarkLayers(map, 'user-location');
    hideMinorPlaceLabels(map);
    if (userLocation) (map.getSource('user-location') as GeoJSONSource).setData(userPoint(userLocation));
    applyLabelLanguage(map, lang);
    onReady();
  });

  const openPin = (e: MapLayerMouseEvent) => {
    const id = e.features?.[0]?.properties.id;
    if (id) latest.current.onSelect?.(id);
  };
  map.on('click', 'pins', openPin);
  map.on('click', 'pin-selected', openPin);

  // クラスターを押すと、まとまりがほどける位置まで拡大する
  map.on('click', 'clusters', async (e) => {
    const feature = e.features?.[0];
    if (!feature) return;
    const zoom = await (map.getSource('pins') as GeoJSONSource).getClusterExpansionZoom(feature.properties.cluster_id);
    map.easeTo({ center: (feature.geometry as Point).coordinates as [number, number], zoom });
  });

  // マウスを載せると指カーソルと店名を表示する
  for (const layer of ['pins', 'pin-selected', 'clusters']) {
    map.on('mousemove', layer, (e) => {
      const canvas = map.getCanvas();
      canvas.style.cursor = 'pointer';
      const id = e.features?.[0]?.properties.id;
      const pin = id && latest.current.pins.find((p) => p.id === id);
      canvas.title = pin ? pin.label : '';
    });
    map.on('mouseleave', layer, () => {
      const canvas = map.getCanvas();
      canvas.style.cursor = '';
      canvas.title = '';
    });
  }
  return map;
}

/** 一覧と同じ店を地図に出す（地図：OpenFreeMap / OpenStreetMap） */
export function MapView({
  pins,
  onSelect,
  height = 360,
  draggable,
  onDrag,
  center,
  selectedId,
  userLocation,
  lang = 'ja',
}: {
  pins: Pin[];
  onSelect?: (id: string) => void;
  height?: number;
  draggable?: boolean;
  onDrag?: (lat: number, lng: number) => void;
  center?: LatLng;
  selectedId?: string;
  userLocation?: LatLng;
  lang?: Lang;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const libRef = useRef<MapLibre | null>(null);
  const readyRef = useRef(false); // ピンのレイヤーを追加済みか
  const dragMarkers = useRef<Marker[]>([]);
  // 地図の読み込み前に届いた値も、読み込み後に反映できるよう最新値を持っておく
  const latest = useRef<State>({ pins, lang });
  latest.current = { pins, selectedId, userLocation, lang, draggable, center, onSelect, onDrag };

  // 呼び出し側は描画のたびに新しい配列を渡すので、中身が変わったときだけ描き直す
  const pinsKey = JSON.stringify(pins);
  const centerKey = center ? `${center.lat},${center.lng}` : '';

  useEffect(() => {
    let map: MlMap | null = null;
    let cancelled = false;

    // MapLibre の読み込み（初回は数百 KB のファイルを取得する）を待ってから地図を作る
    loadMaplibre()
      .then((lib) => {
        if (cancelled || !el.current) return;
        libRef.current = lib;
        map = createMap(lib, el.current, latest, () => {
          readyRef.current = true;
          showPins(map!, lib, dragMarkers.current, latest);
        });
        mapRef.current = map;
      })
      .catch((err) => console.error(err));

    return () => {
      cancelled = true;
      readyRef.current = false;
      mapRef.current = null;
      dragMarkers.current = [];
      map?.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib) return;
    frame(map, lib, latest.current, true);
    if (readyRef.current) showPins(map, lib, dragMarkers.current, latest);
  }, [pinsKey, draggable, centerKey]);

  useEffect(() => {
    if (!readyRef.current) return;
    mapRef.current!.setFilter('pins', pinFilter(selectedId));
    mapRef.current!.setFilter('pin-selected', selectedFilter(selectedId));
  }, [selectedId]);

  useEffect(() => {
    if (readyRef.current && userLocation) {
      (mapRef.current!.getSource('user-location') as GeoJSONSource).setData(userPoint(userLocation));
    }
  }, [userLocation?.lat, userLocation?.lng]);

  useEffect(() => {
    if (readyRef.current) applyLabelLanguage(mapRef.current!, lang);
  }, [lang]);

  return <div ref={el} className="map" style={{ height }} />;
}
