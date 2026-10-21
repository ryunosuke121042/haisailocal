// チャットの写真：添付ボタンと送る前のプレビュー、届いた写真の表示（旅行者・事業者の両方で使う）
import { useRef, useState } from 'react';
import { resizeToDataUrl } from '../lib/image';

interface Labels {
  attach: string;
  remove: string;
  unreadable: string;
}

/** 📷 ボタン。選んだ写真は縮小して onPick に渡す */
export function PhotoAttachButton({ labels, disabled, onPick }: { labels: Labels; disabled?: boolean; onPick: (dataUrl: string) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" className="btn photo-attach" aria-label={labels.attach} title={labels.attach} disabled={disabled || busy} onClick={() => file.current?.click()}>
        📷
      </button>
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setBusy(true);
          const url = await resizeToDataUrl(f, 1280);
          setBusy(false);
          setErr(!url);
          if (url) onPick(url);
        }}
      />
      {err && (
        <p className="notice notice-error small photo-err" role="alert">
          {labels.unreadable}
        </p>
      )}
    </>
  );
}

/** 送る前の写真（× で外せる） */
export function PhotoPreview({ src, removeLabel, onRemove }: { src: string; removeLabel: string; onRemove: () => void }) {
  return (
    <div className="photo-preview">
      <img src={src} alt="" />
      <button type="button" className="photo-remove" aria-label={removeLabel} onClick={onRemove}>
        ✕
      </button>
    </div>
  );
}

/** 届いた写真。タップで元の大きさを別タブで開く */
export function MessagePhoto({ src, alt }: { src: string; alt: string }) {
  return (
    <a href={src} target="_blank" rel="noreferrer" className="msg-photo">
      <img src={src} alt={alt} loading="lazy" />
    </a>
  );
}
