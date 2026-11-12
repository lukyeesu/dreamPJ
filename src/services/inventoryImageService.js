// Reuse the shop's Apps Script upload endpoint; only a Drive URL reaches Supabase.
export function resolveInventoryImageFolder(folders = [], assetsFallback = '') {
  return (folders.find(f => f.type === 'inventory' && f.folderId?.trim())?.folderId
    || folders.find(f => f.type === 'assets' && f.folderId?.trim())?.folderId
    || assetsFallback || '').trim();
}

export function inventoryImageUrl(value) {
  if (!value || typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (!['drive.google.com', 'lh3.googleusercontent.com'].includes(url.hostname)) return null;
    const id = url.searchParams.get('id') || url.pathname.match(/\/d\/([\w-]+)/)?.[1];
    return id && /^[\w-]+$/.test(id) ? `https://lh3.googleusercontent.com/d/${id}` : null;
  } catch { return null; }
}

export async function prepareInventoryImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file?.type)) throw new Error('เลือกรูป JPG, PNG หรือ WebP');
  if (!file.size || file.size > 8 * 1024 * 1024) throw new Error('รูปต้องมีขนาดไม่เกิน 8 MB');
  const localUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = localUrl;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('อ่านรูปภาพไม่ได้');
    const ratio = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('อุปกรณ์นี้เตรียมรูปไม่ได้ กรุณาลองเบราว์เซอร์อื่น');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', 0.78);
    if (!data.startsWith('data:image/jpeg;base64,') || data.length > 2 * 1024 * 1024) throw new Error('รูปยังมีขนาดใหญ่เกินไป กรุณาลดขนาดรูป');
    return data;
  } finally { URL.revokeObjectURL(localUrl); }
}

export async function uploadInventoryImage(file, { folderId, scriptUrl }, {
  prepare = prepareInventoryImage, fetchImpl = fetch
} = {}) {
  if (!folderId || !/^[\w-]+$/.test(folderId)) throw new Error('ตั้งค่า Folder ID รูปสินค้าใน Settings ก่อน');
  let endpoint;
  try { endpoint = new URL(scriptUrl); } catch { throw new Error('ยังไม่ได้ตั้งค่าระบบอัปโหลด Google Drive'); }
  if (endpoint.protocol !== 'https:' || endpoint.hostname !== 'script.google.com' || !endpoint.pathname.endsWith('/exec')) throw new Error('URL อัปโหลด Google Drive ไม่ถูกต้อง');
  const fileData = await prepare(file);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetchImpl(endpoint.href, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'uploadAsset', data: {
        fileData, mimeType: 'image/jpeg', fileName: `inventory_${crypto.randomUUID()}.jpg`, folderId
      } })
    });
    if (!response.ok) throw new Error('อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่');
    const result = await response.json();
    if (result.status !== 'success') throw new Error('Google Drive อัปโหลดรูปไม่สำเร็จ');
    const url = result.fileId && /^[\w-]+$/.test(result.fileId)
      ? `https://drive.google.com/uc?export=view&id=${result.fileId}` : result.url;
    if (!inventoryImageUrl(url)) throw new Error('Google Drive ไม่ได้ส่ง URL รูปที่ใช้งานได้');
    return url;
  } finally { clearTimeout(timeout); }
}
