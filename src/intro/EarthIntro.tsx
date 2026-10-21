// トップページのオープニング：宇宙に浮かぶ地球 → 日本（関西）へ近づく → 真っ白になり、ロゴが出る。
// 地球の画像は NASA の Blue Marble / Black Marble（パブリックドメイン）。昼・夜景・雲・日本付近の高解像度の4枚だけを使う。
// 重くしないため：この画面を開いたときだけ読み込み（遅延読み込み）、画素密度は1.5倍まで、白くなったら描画をやめて GPU を解放する
import { useEffect, useRef, useState } from 'react';
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Group,
  LinearMipmapLinearFilter,
  Mesh,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  WebGLRenderer,
  type Texture,
} from 'three';
import { LogoMark, WordmarkSvg } from '../components/Logo';
import { LANG_LABELS, LANGS, type Lang } from '../../shared/constants';
import { EdoPanorama } from './EdoPanorama';

// 関西（京都と大阪の間）を画面の正面に持ってくる
const TARGET = { lon: 135.6, lat: 34.8 };
// 高解像度の日本付近の画像の範囲（経度122〜150度、緯度24〜46度）
const DETAIL = { lonMin: 122, lonMax: 150, latMin: 24, latMax: 46 };

// 時間の流れ（秒）
const T = { drift: 1.6, turnEnd: 4.4, diveEnd: 5.7, white: 5.15, logo: 5.8, out: 10.4 };

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeIn = (t: number) => t * t * t;

const earthVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const earthFragment = /* glsl */ `
  uniform sampler2D uDay;
  uniform sampler2D uNight;
  uniform sampler2D uDetail;
  uniform vec4 uDetailBox; // lonMin, lonMax, latMin, latMax
  uniform float uDetailMix;
  uniform vec3 uSun;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vWorld;
  void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 day = texture2D(uDay, vUv).rgb;
    // 日本付近は高解像度の画像に差し替える（縁はなめらかにつなぐ）
    float lon = vUv.x * 360.0 - 180.0;
    float lat = vUv.y * 180.0 - 90.0;
    vec2 d = vec2((lon - uDetailBox.x) / (uDetailBox.y - uDetailBox.x), (lat - uDetailBox.z) / (uDetailBox.w - uDetailBox.z));
    if (uDetailMix > 0.0 && d.x > 0.0 && d.x < 1.0 && d.y > 0.0 && d.y < 1.0) {
      float edge = smoothstep(0.0, 0.08, d.x) * smoothstep(1.0, 0.92, d.x) * smoothstep(0.0, 0.08, d.y) * smoothstep(1.0, 0.92, d.y);
      day = mix(day, texture2D(uDetail, d).rgb, edge * uDetailMix);
    }
    float l = dot(N, uSun);
    float dayAmt = smoothstep(-0.16, 0.24, l);
    // 海だけ太陽を照り返す
    float water = smoothstep(0.015, 0.09, day.b - max(day.r, day.g) * 0.9);
    vec3 H = normalize(uSun + V);
    float spec = pow(max(dot(N, H), 0.0), 70.0) * water;
    vec3 lit = day * (0.035 + 1.2 * max(l, 0.0)) + spec * vec3(1.0, 0.9, 0.75) * 0.8;
    // 夜側は街の灯り
    vec3 night = texture2D(uNight, vUv).rgb;
    night = pow(night, vec3(1.6)) * vec3(1.0, 0.72, 0.42) * 2.6;
    vec3 col = mix(night, lit, dayAmt);
    // 大気のふち（昼側ほど明るい）
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.2);
    col += vec3(0.28, 0.55, 1.0) * fres * (0.12 + 0.9 * smoothstep(-0.35, 0.7, l));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const cloudFragment = /* glsl */ `
  uniform sampler2D uClouds;
  uniform vec3 uSun;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vN;
  void main() {
    float c = texture2D(uClouds, vUv).r;
    c = smoothstep(0.18, 0.9, c);
    // 日本の上空は晴れにする（近づいたときに雲で隠れないように。縁はなめらかに）
    float lon = vUv.x * 360.0 - 180.0;
    float lat = vUv.y * 180.0 - 90.0;
    float japan = smoothstep(120.0, 128.0, lon) * (1.0 - smoothstep(146.0, 154.0, lon)) * smoothstep(20.0, 27.0, lat) * (1.0 - smoothstep(44.0, 50.0, lat));
    c *= 1.0 - 0.95 * japan;
    float l = dot(normalize(vN), uSun);
    float light = 0.04 + 0.96 * smoothstep(-0.12, 0.5, l);
    gl_FragColor = vec4(vec3(light), c * uOpacity);
    #include <colorspace_fragment>
  }
`;

const glowVertex = /* glsl */ `
  varying float vI;
  varying vec3 vN;
  void main() {
    vec3 n = normalize(normalMatrix * normal);
    vN = normalize(mat3(modelMatrix) * normal);
    vI = pow(clamp(0.72 - dot(n, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 3.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const glowFragment = /* glsl */ `
  uniform vec3 uSun;
  uniform float uOpacity;
  varying float vI;
  varying vec3 vN;
  void main() {
    float side = 0.25 + 0.75 * smoothstep(-0.4, 0.6, dot(vN, uSun));
    gl_FragColor = vec4(vec3(0.3, 0.6, 1.0) * vI * side * 1.6 * uOpacity, 1.0);
  }
`;

const starVertex = /* glsl */ `
  attribute float aSize;
  attribute float aTone;
  varying float vTone;
  uniform float uPixel;
  void main() {
    vTone = aTone;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixel;
    gl_Position = projectionMatrix * mv;
  }
`;

const starFragment = /* glsl */ `
  varying float vTone;
  uniform float uOpacity;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(mix(vec3(0.75, 0.83, 1.0), vec3(1.0, 0.95, 0.85), vTone), a * uOpacity);
  }
`;

/** 経度・緯度の点を画面の正面（+z）に向けるための回転（SphereGeometry の UV の向きに合わせる） */
function facing(lon: number, lat: number) {
  const phi = ((lon + 180) / 360) * Math.PI * 2;
  return { y: Math.PI / 2 - phi, x: (lat * Math.PI) / 180 };
}

function makeStars(count: number) {
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const tone = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // 球面上に均等に散らす
    const u = Math.random() * 2 - 1;
    const a = Math.random() * Math.PI * 2;
    const r = 60 + Math.random() * 30;
    const s = Math.sqrt(1 - u * u);
    pos.set([r * s * Math.cos(a), r * u, r * s * Math.sin(a)], i * 3);
    size[i] = Math.random() < 0.06 ? 2.6 + Math.random() * 1.6 : 0.9 + Math.random() * 1.3;
    tone[i] = Math.random();
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('aSize', new BufferAttribute(size, 1));
  g.setAttribute('aTone', new BufferAttribute(tone, 1));
  return g;
}

function loadTexture(loader: TextureLoader, url: string, srgb = true): Promise<Texture> {
  return new Promise((resolve, reject) =>
    loader.load(
      url,
      (t) => {
        if (srgb) t.colorSpace = SRGBColorSpace;
        t.anisotropy = 4;
        t.minFilter = LinearMipmapLinearFilter;
        resolve(t);
      },
      undefined,
      reject,
    ),
  );
}

type Phase = 'loading' | 'space' | 'white' | 'logo' | 'out';

export default function EarthIntro({
  tagline,
  skipLabel,
  onDone,
  onPickLang,
}: {
  tagline: string;
  skipLabel: string;
  onDone: () => void;
  /** 一枚絵の上で言語名を選んだとき（その言語でサイトに入る） */
  onPickLang: (lang: Lang) => void;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const done = useRef(false);

  function finish() {
    if (done.current) return;
    done.current = true;
    setPhase('out');
    setTimeout(onDone, 700);
  }
  /** 言語名を選んだら、その言語でサイトに入る */
  function pick(lang: Lang) {
    if (done.current) return;
    done.current = true;
    setPhase('out');
    setTimeout(() => onPickLang(lang), 500);
  }


  useEffect(() => {
    // 開発時の確認用：?introPhase=logo でロゴの場面のまま止める
    const devPhase = import.meta.env.DEV ? new URLSearchParams(location.search).get('introPhase') : null;
    if (devPhase === 'logo') {
      setPhase('logo');
      return;
    }
    // ?introPhase=white：3D を飛ばし、白くなるところからロゴの場面までを本番と同じ間合いで流す
    if (devPhase === 'white') {
      setPhase('white');
      const t = setTimeout(() => setPhase('logo'), (T.logo - T.white) * 1000);
      return () => clearTimeout(t);
    }
    // 描画先はマウントのたびに作り直す（閉じた 3D の文脈を使い回さない）
    const el = document.createElement('canvas');
    el.className = 'intro-canvas';
    holder.current!.prepend(el);
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas: el, antialias: window.devicePixelRatio < 2, powerPreference: 'high-performance' });
    } catch {
      // 3D が使えない端末：ロゴだけ見せる
      el.remove();
      setPhase('logo');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x03050c, 1);

    const scene = new Scene();
    const camera = new PerspectiveCamera(38, 1, 0.01, 200);
    // 太陽は左手前。右側が夜になり、街の灯りが見える
    const sun = new Vector3(-0.82, 0.3, 0.5).normalize();

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      starMat.uniforms.uPixel.value = renderer.getPixelRatio() * Math.max(1, Math.min(w, h) / 700);
    };

    // 星
    const starMat = new ShaderMaterial({
      vertexShader: starVertex,
      fragmentShader: starFragment,
      uniforms: { uPixel: { value: 1 }, uOpacity: { value: 0 } },
      transparent: true,
      depthWrite: false,
    });
    const stars = new Points(makeStars(window.innerWidth < 700 ? 1400 : 2400), starMat);
    scene.add(stars);

    // 地球（外側：緯度で傾ける／内側：経度で回す）
    const tilt = new Group();
    const spin = new Group();
    tilt.add(spin);
    scene.add(tilt);
    const segments = window.innerWidth < 700 ? 96 : 128;
    const sphere = new SphereGeometry(1, segments, segments / 2);
    const earthMat = new ShaderMaterial({
      vertexShader: earthVertex,
      fragmentShader: earthFragment,
      uniforms: {
        uDay: { value: null },
        uNight: { value: null },
        uDetail: { value: null },
        uDetailBox: { value: [DETAIL.lonMin, DETAIL.lonMax, DETAIL.latMin, DETAIL.latMax] },
        uDetailMix: { value: 0 },
        uSun: { value: sun },
      },
    });
    spin.add(new Mesh(sphere, earthMat));
    const cloudMat = new ShaderMaterial({
      vertexShader: earthVertex,
      fragmentShader: cloudFragment,
      uniforms: { uClouds: { value: null }, uSun: { value: sun }, uOpacity: { value: 0 } },
      transparent: true,
      depthWrite: false,
    });
    const clouds = new Mesh(new SphereGeometry(1.006, segments, segments / 2), cloudMat);
    spin.add(clouds);
    const glowMat = new ShaderMaterial({
      vertexShader: glowVertex,
      fragmentShader: glowFragment,
      uniforms: { uSun: { value: sun }, uOpacity: { value: 1 } },
      side: BackSide,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    scene.add(new Mesh(new SphereGeometry(1.09, 64, 32), glowMat));

    resize();
    window.addEventListener('resize', resize);

    // 画像を読み込む（雲はなくても始める）。届かなければロゴだけ見せる
    const loader = new TextureLoader();
    let raf = 0;
    let start = 0;
    let stopped = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const giveUp = setTimeout(() => {
      if (!start) {
        stopped = true;
        setPhase('logo');
      }
    }, 7000);

    // 開発時の確認用：?introAt=秒 でその瞬間の絵で止める
    const freezeAt = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('introAt')) || 0 : 0;
    Promise.all([loadTexture(loader, '/intro/earth-day.webp'), loadTexture(loader, '/intro/earth-night.webp'), loadTexture(loader, '/intro/japan-detail.webp')])
      .then(([day, night, detail]) => {
        if (stopped) return;
        earthMat.uniforms.uDay.value = day;
        earthMat.uniforms.uNight.value = night;
        earthMat.uniforms.uDetail.value = detail;
        loadTexture(loader, '/intro/earth-clouds.webp', false)
          .then((c) => (cloudMat.uniforms.uClouds.value = c))
          .catch(() => {});
        clearTimeout(giveUp);
        setPhase('space');
        start = performance.now();
        // 先に GPU へ送っておき、最初のコマでつかえないようにする
        renderer.compile(scene, camera);
        if (!freezeAt) {
          timers.push(setTimeout(() => setPhase('white'), T.white * 1000));
          timers.push(setTimeout(() => setPhase('logo'), T.logo * 1000));
        }
        raf = requestAnimationFrame(frame);
      })
      .catch(() => {
        stopped = true;
        setPhase('logo');
      });

    const startView = { lon: 8, lat: 12 };
    // 最初は地球全体が収まる距離（縦長のスマホでは横幅に合わせて遠ざける）
    const startDist = () => {
      const half = Math.tan(((38 / 2) * Math.PI) / 180);
      return Math.max(4.1, 1 / (0.84 * half * camera.aspect));
    };
    function frame(now: number) {
      const t = freezeAt || (now - start) / 1000;
      // 1) ゆっくり回る地球  2) 日本へ向きを変えながら近づく  3) 一気に降下
      let lon: number, lat: number, dist: number, fov = 38;
      if (t < T.drift) {
        lon = startView.lon + t * 5;
        lat = startView.lat;
        dist = startDist() - t * 0.15;
      } else if (t < T.turnEnd) {
        const p = easeInOut((t - T.drift) / (T.turnEnd - T.drift));
        lon = lerp(startView.lon + T.drift * 5, TARGET.lon, p);
        lat = lerp(startView.lat, TARGET.lat, p);
        dist = lerp(startDist() - T.drift * 0.15, camera.aspect < 1 ? 2.6 : 1.95, p);
      } else {
        const p = easeIn(clamp01((t - T.turnEnd) / (T.diveEnd - T.turnEnd)));
        lon = TARGET.lon;
        lat = TARGET.lat;
        dist = lerp(camera.aspect < 1 ? 2.6 : 1.95, 1.16, p);
        fov = lerp(38, 54, p);
      }
      const f = facing(lon, lat);
      spin.rotation.y = f.y;
      tilt.rotation.x = f.x;
      camera.position.set(0, 0, dist);
      camera.fov = fov;
      camera.updateProjectionMatrix();
      camera.lookAt(0, 0, 0);
      starMat.uniforms.uOpacity.value = clamp01(t / 1.2) * (1 - clamp01((t - T.turnEnd) / 0.8));
      earthMat.uniforms.uDetailMix.value = clamp01((t - 3.4) / 0.9);
      // 雲は日本へ向かう途中から薄くし、降下の前に消す
      cloudMat.uniforms.uOpacity.value = 0.95 * clamp01(t / 0.8) * (1 - clamp01((t - 3.3) / 1.1));
      glowMat.uniforms.uOpacity.value = 1 - clamp01((t - T.turnEnd) / 1.0) * 0.6;
      renderer.render(scene, camera);
      if ((freezeAt || t < T.diveEnd + 0.3) && !stopped) raf = requestAnimationFrame(frame);
      else cleanup();
    }

    let cleaned = false;
    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      scene.traverse((o) => {
        const m = o as Mesh;
        m.geometry?.dispose();
        const mat = m.material as ShaderMaterial | undefined;
        if (mat) {
          for (const u of Object.values(mat.uniforms ?? {})) (u.value as Texture | null)?.dispose?.();
          mat.dispose();
        }
      });
      renderer.dispose();
      renderer.forceContextLoss();
      el.remove();
    }

    return () => {
      clearTimeout(giveUp);
      timers.forEach(clearTimeout);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={holder} className={`intro is-${phase}`} aria-hidden={phase === 'out'}>
      <div className="intro-flash" />
      <div className="intro-logo" aria-live="polite">
        <EdoPanorama />
        <div className="intro-halo" />
        <LogoMark size={112} className="intro-mark" />
        <WordmarkSvg className="intro-word" />
        <p className="intro-tagline">
          {/* 「 · 」で区切った言葉ごとに改行し、言葉の途中では折り返さない */}
          {tagline.split(' · ').map((x, i) => (
            <span key={x}>
              {i > 0 && <span className="intro-sep"> · </span>}
              <span className="intro-phrase">{x}</span>
            </span>
          ))}
        </p>
        {/* 言語名だけを並べる（説明の文は出さない）。選ぶとその言語でサイトに入る */}
        <nav className="intro-langs" aria-label="Language">
          {LANGS.map((l, i) => (
            <button key={l} type="button" lang={l} className="intro-lang" style={{ '--i': i } as React.CSSProperties} onClick={() => pick(l)}>
              {LANG_LABELS[l]}
            </button>
          ))}
        </nav>
      </div>
      <button type="button" className="intro-skip" onClick={finish}>
        {skipLabel} ›
      </button>
    </div>
  );
}
