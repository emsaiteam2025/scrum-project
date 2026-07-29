// 使用 Client SDK 取代 Admin SDK，避免需要服務帳戶金鑰
// （組織政策禁止建立服務帳戶金鑰；sprints 改以開放唯讀規則供 cron 讀取）
export { db as adminDb } from '@/lib/firebase';
