import { NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
]);

export async function POST(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: '尚未設定 BLOB_READ_WRITE_TOKEN，請先在 Vercel 建立 Blob 儲存並執行 vercel env pull。' },
      { status: 500 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: '無法解析上傳內容。' }, { status: 400 });
  }

  const file = form.get('file');
  const sprintId = String(form.get('sprintId') || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_') || 'unknown';
  const uploadedBy = String(form.get('uploadedBy') || '');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '請選擇要上傳的檔案。' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: '檔案超過 10 MB 上限。' }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: `不支援的檔案類型：${file.type || '未知'}。僅接受圖片、PDF、Office 文件與 zip。` },
      { status: 400 }
    );
  }

  try {
    const safeName = file.name.replace(/[^\w.\-一-龥]/g, '_');
    const blob = await put(`scrum/${sprintId}/${safeName}`, file, {
      access: 'public',
      addRandomSuffix: true,
    });

    return NextResponse.json({
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      url: blob.url,
      size: file.size,
      contentType: file.type,
      uploadedBy,
      uploadedAt: Date.now(),
    });
  } catch (err) {
    console.error('[upload] 失敗', err);
    return NextResponse.json({ error: '上傳失敗，請稍後再試。' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: '尚未設定 BLOB_READ_WRITE_TOKEN。' }, { status: 500 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '無法解析刪除請求內容。' }, { status: 400 });
  }

  const url = (body as { url?: unknown } | null)?.url;
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: '缺少要刪除的檔案網址。' }, { status: 400 });
  }

  try {
    await del(url);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[upload] 刪除失敗', err);
    return NextResponse.json({ error: '刪除失敗，請稍後再試。' }, { status: 500 });
  }
}
