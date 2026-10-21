// 写真は端末側で縮小・JPEG にしてから送る（通信量とサーバーの保存量を抑える）
import { LIMITS } from '../../shared/constants';

/** 長い辺を maxEdge px までに縮め、LIMITS.photoMaxBytes に収まる JPEG の data URL にする。読めない形式なら null */
export async function resizeToDataUrl(file: File, maxEdge = 1200): Promise<string | null> {
  const img = await createImageBitmap(file).catch(() => null);
  if (!img) return null;
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  img.close?.();
  let q = 0.82;
  let url = c.toDataURL('image/jpeg', q);
  while (url.length > LIMITS.photoMaxBytes * 1.33 && q > 0.4) url = c.toDataURL('image/jpeg', (q -= 0.1));
  return url;
}
