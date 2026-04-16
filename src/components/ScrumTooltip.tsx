"use client";
import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function ScrumTooltip({ keyword, text }: { keyword: string, text: string }) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, arrowOffset: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);

  // 取得 2020 Scrum Guide 繁體中文版 的定義說明
  const getScrumGuideText = (kw: string) => {
    switch (kw) {
      case 'Sprint Planning':
        return '【Sprint Planning 衝刺規劃】\n啟動 Sprint，由 Scrum 團隊共同制定。需討論三個主題：\n1. Why：這個 Sprint 的價值為何？\n2. What：這個 Sprint 能完成什麼？\n3. How：所選的工作將如何完成？\n(時間盒：一個月的 Sprint 最多 8 小時)';
      case 'PO':
        return '【Product Owner 產品負責人】\n負責將 Scrum 團隊的工作所產生的產品價值最大化。全權負責有效管理 Product Backlog (產品待辦清單)，包含清晰表達待辦項目與排序。';
      case 'SM':
        return '【Scrum Master】\n負責依據 Scrum 指南建立 Scrum。是 Scrum 團隊與組織的服務型領導者，負責移除開發阻礙，並確保所有 Scrum 事件順利進行並保持在時間盒內。';
      case 'DEVS':
        return '【Developers 開發人員】\nScrum 團隊中致力於在每個 Sprint 建立可用 Increment (增量) 的人員。負責建立 Sprint Backlog、每天調整計畫邁向 Sprint 目標。';
      case 'Sprint':
        return '【Sprint 衝刺】\nScrum 的心跳，所有工作都在此發生。為期一個月或更短，具有一致的長度。前一個 Sprint 結束後下一個會立即開始。';
      case 'Daily Scrum':
        return '【Daily Scrum 每日站會】\n目的是檢視邁向 Sprint 目標的進度，並調整接下來的計畫。為期 15 分鐘，僅限開發人員參加。';
      case 'Sprint Review':
        return '【Sprint Review 衝刺檢視】\n目的是檢視 Sprint 的結果並決定未來的適應性調整。向利益關係人展示工作成果。 (時間盒：一個月的 Sprint 最多 4 小時)';
      case 'Sprint Retrospective':
        return '【Sprint Retrospective 衝刺回顧】\n目的是規劃提高品質和效率的方法。檢視團隊在人員、互動、流程與工具上的表現。 (時間盒：一個月的 Sprint 最多 3 小時)';
      case 'WHY':
        return '【主題一：Why】\nPO 提議該 Sprint 如何提高產品的價值。整個 Scrum 團隊協作定義出一個「Sprint 目標」。';
      case 'WHAT':
        return '【主題二：What】\n開發人員與 PO 討論，從 Product Backlog 挑選項目放入目前的 Sprint 中。';
      case 'HOW':
        return '【主題三：How】\n開發人員規劃要如何將挑選出的項目轉化為 Increments (增量)。這通常需要將項目分解為一天或更短時間內能完成的工作。';
      case 'Sprint Backlog':
        return '【Sprint Backlog 衝刺待辦清單】\n由開發人員為開發人員制定的計畫。這是一幅高度可見的即時畫面，包含 Sprint 目標、為 Sprint 挑選的 Product Backlog 項目，以及交付增量的具體計畫。';
      case 'Product Backlog':
        return '【Product Backlog 產品待辦清單】\n一份突現且有排序的清單，列出了改善產品所需的事項。這是 Scrum 團隊所承擔工作的唯一來源。';
      case 'Increment':
        return '【Increment 增量】\n邁向產品目標的具體墊腳石。每個增量都加到所有先前的增量上，並且必須經過徹底的驗證（符合 DoD）以確保可用。';
      default:
        return '參考 2020 Scrum Guide。';
    }
  };

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const targetCenter = rect.left + window.scrollX + (rect.width / 2);
      
      let left = targetCenter;
      let arrowOffset = 0;

      // 邊界保護 (Tooltip 寬度 320px，一半是 160px)
      const margin = 20;
      const minLeft = 160 + margin;
      const maxLeft = document.documentElement.clientWidth - 160 - margin;

      if (left < minLeft) {
        arrowOffset = left - minLeft; // 負值，箭頭偏左
        left = minLeft;
      } else if (left > maxLeft) {
        arrowOffset = left - maxLeft; // 正值，箭頭偏右
        left = maxLeft;
      }

      setCoords({
        top: rect.bottom + window.scrollY + 8,
        left: left,
        arrowOffset: arrowOffset
      });
    }
  };

  const handleMouseEnter = () => {
    updatePosition();
    setShow(true);
  };

  const handleClick = () => {
    if (!show) updatePosition();
    setShow(!show);
  };

  const tooltipContent = show && typeof document !== 'undefined' ? createPortal(
    <div 
      className="absolute w-[320px] p-5 bg-[#fffdf9] border-2 border-[#8fb996] rounded-xl shadow-2xl text-[15px] text-[#3e362e] font-sans font-medium normal-case break-words whitespace-pre-line pointer-events-none z-[999999]"
      style={{ top: `${coords.top}px`, left: `${coords.left}px`, transform: 'translateX(-50%)' }}
    >
      {getScrumGuideText(keyword)}
      <div 
        className="absolute -top-[9px] w-4 h-4 bg-[#fffdf9] border-t-2 border-l-2 border-[#8fb996] transform rotate-45"
        style={{ left: `calc(50% + ${coords.arrowOffset}px - 8px)` }}
      ></div>
    </div>,
    document.body
  ) : null;

  return (
    <span 
      ref={triggerRef}
      className="inline-flex items-center gap-1 cursor-pointer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShow(false)}
      onClick={handleClick}
    >
      <span className="border-b-2 border-dashed border-[#76a5af] cursor-help transition-colors hover:text-[#467386]">
        {text}
      </span>
      <span className="cursor-help text-[#76a5af] hover:text-[#467386] transition-colors text-sm" title="點擊或懸停查看 Scrum Guide 提示">
        💡
      </span>
      {tooltipContent}
    </span>
  );
}
