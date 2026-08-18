// 伺服器端驗證 Firebase ID Token。
//
// 為什麼不用 firebase-admin：Admin SDK 是為了「代表專案操作資源」而設計，
// 初始化需要 service account 私鑰。但單純「驗證這個 token 是不是 Google 簽的、
// 是不是簽給本專案的」只需要 Google 的**公開**憑證，不需要任何私密憑證。
// 因此這裡直接用 jose 對公開 JWKS 驗簽，專案不必保管私鑰。
//
// createRemoteJWKSet 會在模組層快取金鑰，同一個 lambda 實例重複呼叫不會重抓。

import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export interface VerifiedUser {
  uid: string;
  email: string;
}

/**
 * 驗證 Authorization: Bearer <idToken>。
 * 通過回傳 { uid, email }，否則回傳 null（呼叫端一律當成 401）。
 */
export async function verifyRequestUser(req: Request): Promise<VerifiedUser | null> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    console.error('[verifyAuth] 缺少 NEXT_PUBLIC_FIREBASE_PROJECT_ID，無法驗證身分');
    return null;
  }

  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });

    // jwtVerify 已驗過簽章、iss、aud 與 exp；Firebase 另外保證 sub 就是 uid，
    // 且未登入者拿不到會通過上述檢查的 token。
    const uid = typeof payload.sub === 'string' ? payload.sub : '';
    if (!uid) return null;

    const email = typeof payload.email === 'string' ? payload.email : '';
    return { uid, email };
  } catch {
    // 簽章不符、過期、發行者/受眾不對，都走這裡
    return null;
  }
}
