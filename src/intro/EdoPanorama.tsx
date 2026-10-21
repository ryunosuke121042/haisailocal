// ロゴの後ろに広がる浮世絵風の一枚絵（夕暮れの富士と湾、提灯の灯る町並み、桜）。
// 画像は public/intro/edo*.webp。地球の場面の間に読み込んでおき、白い光の中から浮かび上がらせる
export function EdoPanorama() {
  return (
    <div className="edo" aria-hidden>
      {/* スマホなど縦長の画面は、富士・太陽・五重塔を中心にした縦長の絵 */}
      <picture>
        <source media="(max-aspect-ratio: 1/1)" srcSet="/intro/edo-mobile.webp" />
        <img
          className="edo-img"
          src="/intro/edo.webp"
          srcSet="/intro/edo-sm.webp 900w, /intro/edo.webp 1536w"
          sizes="100vw"
          alt=""
          decoding="async"
          draggable={false}
        />
      </picture>
    </div>
  );
}
