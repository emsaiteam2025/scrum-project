// ── 取得使用者可存取的 Sprint 清單（共用查詢）──
// 「我擁有的」與「我是協作者的」是兩個獨立查詢，Firestore 無法用單一 query 表達，
// 因此分開查再合併去重。兩邊各自 try/catch：其中一個因權限失敗時，另一個仍要有資料。

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';

export interface SprintUser {
  uid: string;
  email: string | null;
}

export interface SprintPlanning {
  po?: string;
  devs?: string;
  devsList?: { name: string }[];
}

// 開發成員有兩種存法：結構化的 devsList，以及舊的逗號分隔字串 devs
export function getDevNames(planning?: SprintPlanning): string[] {
  if (!planning) return [];
  if (Array.isArray(planning.devsList) && planning.devsList.length > 0)
    return planning.devsList.map(d => d.name).filter(Boolean);
  if (typeof planning.devs === 'string' && planning.devs)
    return planning.devs.split(',').map(n => n.trim()).filter(Boolean);
  return [];
}

export async function fetchAccessibleSprints<T>(user: SprintUser): Promise<(T & { id: string })[]> {
  const ref = collection(db, 'sprints');
  const byId = new Map<string, T & { id: string }>();

  const collect = async (q: ReturnType<typeof query>) => {
    try {
      const snap = await getDocs(q);
      snap.forEach(d => {
        if (!byId.has(d.id)) byId.set(d.id, { ...(d.data() as T), id: d.id });
      });
    } catch {
      /* 權限不足或索引缺失時略過這個來源 */
    }
  };

  await collect(query(ref, where('ownerId', '==', user.uid)));
  if (user.email) {
    await collect(query(ref, where('collaboratorEmails', 'array-contains', user.email)));
  }

  const list = Array.from(byId.values());
  list.sort((a, b) => {
    const ta = (a as { createdAt?: number }).createdAt || 0;
    const tb = (b as { createdAt?: number }).createdAt || 0;
    return ta - tb;
  });
  return list;
}
