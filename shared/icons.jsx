// Lucide-style line icons — single source of truth
const IconBase = ({ size = 18, stroke = 1.75, children, style = {}, ...rest }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size}
       viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
       style={{ flexShrink: 0, ...style }} {...rest}>
    {children}
  </svg>
);

const Icons = {
  Sprint: (p) => <IconBase {...p}><path d="M21 12a9 9 0 1 1-9-9"/><path d="M21 3v6h-6"/></IconBase>,
  Target: (p) => <IconBase {...p}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></IconBase>,
  Flag:   (p) => <IconBase {...p}><path d="M4 22V4"/><path d="M4 4h14l-3 5 3 5H4"/></IconBase>,
  Board:  (p) => <IconBase {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18"/></IconBase>,
  Chart:  (p) => <IconBase {...p}><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-7"/></IconBase>,
  Users:  (p) => <IconBase {...p}><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 20a4.5 4.5 0 0 1 6.5-4"/></IconBase>,
  User:   (p) => <IconBase {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></IconBase>,
  Plus:   (p) => <IconBase {...p}><path d="M12 5v14M5 12h14"/></IconBase>,
  Check:  (p) => <IconBase {...p}><path d="M4 12l5 5L20 6"/></IconBase>,
  X:      (p) => <IconBase {...p}><path d="M6 6l12 12M18 6L6 18"/></IconBase>,
  Arrow:  (p) => <IconBase {...p}><path d="M5 12h14M13 5l7 7-7 7"/></IconBase>,
  ArrowUp:(p) => <IconBase {...p}><path d="M12 19V5M5 12l7-7 7 7"/></IconBase>,
  Clock:  (p) => <IconBase {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></IconBase>,
  Calendar:(p)=> <IconBase {...p}><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></IconBase>,
  Edit:   (p) => <IconBase {...p}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></IconBase>,
  Trash:  (p) => <IconBase {...p}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></IconBase>,
  Share:  (p) => <IconBase {...p}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></IconBase>,
  Settings:(p)=> <IconBase {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></IconBase>,
  Search: (p) => <IconBase {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></IconBase>,
  Bell:   (p) => <IconBase {...p}><path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16Z"/><path d="M10 21a2 2 0 0 0 4 0"/></IconBase>,
  Filter: (p) => <IconBase {...p}><path d="M3 4h18l-7 9v6l-4 2v-8Z"/></IconBase>,
  Sparkle:(p) => <IconBase {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></IconBase>,
  Zap:    (p) => <IconBase {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7Z"/></IconBase>,
  Kanban: (p) => <IconBase {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7v7M12 7v4M16 7v10"/></IconBase>,
  Book:   (p) => <IconBase {...p}><path d="M4 4h13a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4Z"/><path d="M4 4v16"/></IconBase>,
  Circle: (p) => <IconBase {...p}><circle cx="12" cy="12" r="9"/></IconBase>,
  Dot:    (p) => <IconBase {...p}><circle cx="12" cy="12" r="3" fill="currentColor"/></IconBase>,
  More:   (p) => <IconBase {...p}><circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/></IconBase>,
  Folder: (p) => <IconBase {...p}><path d="M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></IconBase>,
  Layers: (p) => <IconBase {...p}><path d="M12 2 2 7l10 5 10-5Z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/></IconBase>,
  Play:   (p) => <IconBase {...p}><path d="M6 4v16l14-8Z"/></IconBase>,
  Pause:  (p) => <IconBase {...p}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></IconBase>,
  ChevronRight:(p)=><IconBase {...p}><path d="m9 6 6 6-6 6"/></IconBase>,
  ChevronDown: (p)=><IconBase {...p}><path d="m6 9 6 6 6-6"/></IconBase>,
  Globe:  (p) => <IconBase {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></IconBase>,
  Lightning:(p)=><IconBase {...p}><path d="M13 2L3 14h7l-1 8 10-12h-7Z"/></IconBase>,
  Eye:    (p) => <IconBase {...p}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></IconBase>,
  Link:   (p) => <IconBase {...p}><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></IconBase>,
  Copy:   (p) => <IconBase {...p}><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></IconBase>,
  Leaf:   (p) => <IconBase {...p}><path d="M11 20a7 7 0 0 0 9-9l1-7h-7a7 7 0 0 0-7 7v9Z"/><path d="M13 13l-8 8"/></IconBase>,
  ArrowDown:(p)=><IconBase {...p}><path d="M12 5v14M5 12l7 7 7-7"/></IconBase>,
  TrendingUp:(p)=><IconBase {...p}><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></IconBase>,
  Flame:  (p) => <IconBase {...p}><path d="M12 2s4 4 4 8a4 4 0 0 1-1 2.7C16 15 18 13 18 10c3 2 3 8 0 11a7 7 0 0 1-12 0c-3-3-2-7 0-10 2 3 4 3 5-1 0-3-2-5-3-5 2-2 4-3 4-3Z"/></IconBase>,
};

window.Icons = Icons;
