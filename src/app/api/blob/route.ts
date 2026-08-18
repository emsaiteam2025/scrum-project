// private Blob 讀取代理。
//
// 為什麼需要它：store 建成 private 後，blob 的原始 URL 不能直接放進 <img src>
// 或下載連結——那正是 private 的意義。這支路由先驗 Firebase ID Token，通過才
// 用伺服器端的 RW token 把檔案串回來。
//
// 前端不會（也不能）在 <img src> 上帶 Authorization header，所以呼叫端是用
// fetch 取回內容後轉成 object URL 再顯示，詳見 src/components/AttachmentBox.tsx。

import { NextResponse } from 'next/server';
import { get } from '@vercel/blob';
import { verifyRequestUser } from '@/lib/verifyAuth';

export async function GET(req: Request) {
  const actor = await verifyRequestUser(req);
  if (!actor) {
    return NextResponse.json({ error: '請先登入後再檢視檔案。' }, { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: '尚未設定 BLOB_READ_WRITE_TOKEN。' }, { status: 500 });
  }

  const pathname = new URL(req.url).searchParams.get('p');
  if (!pathname) {
    return NextResponse.json({ error: '缺少檔案路徑。' }, { status: 400 });
  }

  try {
    const result = await get(pathname, { access: 'private' });
    if (!result) {
      return NextResponse.json({ error: '找不到這個檔案。' }, { status: 404 });
    }

    return new Response(result.stream, {
      headers: {
        'Content-Type': result.blob?.contentType || 'application/octet-stream',
        // 私有內容不得進入共用快取；瀏覽器端短暫快取即可，避免同一張縮圖重複下載
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (err) {
    console.error('[blob] 讀取失敗', err);
    return NextResponse.json({ error: '讀取檔案失敗。' }, { status: 500 });
  }
}
