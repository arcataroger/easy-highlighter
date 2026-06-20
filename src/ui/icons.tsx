import React from "react";

function Svg(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

type P = React.SVGProps<SVGSVGElement>;

export const FolderIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
  </Svg>
);

export const WandIcon = (p: P) => (
  <Svg {...p} fill="none" strokeWidth="1.8">
    {/* White I-beam text selector cursor */}
    <path d="M 4 3 L 10 3 L 10 5 L 8.5 5 C 8 5 8 5.5 8 6 L 8 18 C 8 18.5 8 19 8.5 19 L 10 19 L 10 21 L 4 21 L 4 19 L 5.5 19 C 6 19 6 18.5 6 18 L 6 6 C 6 5.5 6 5 5.5 5 L 4 5 Z" fill="#fff" stroke="currentColor" strokeLinejoin="round" />
    {/* Yellow Sparkles (Top Right) */}
    <path d="M 16, 4 Q 16, 10 22, 10 Q 16, 10 16, 16 Q 16, 10 10, 10 Q 16, 10 16, 4 Z" fill="#ffe14d" stroke="none" />
    <path d="M 13, 0 Q 13, 3 16, 3 Q 13, 3 13, 6 Q 13, 3 10, 3 Q 13, 3 13, 0 Z" fill="#ffe14d" stroke="none" />
    <path d="M 12.5, 12 Q 12.5, 14.5 15, 14.5 Q 12.5, 14.5 12.5, 17 Q 12.5, 14.5 10, 14.5 Q 12.5, 14.5 12.5, 12 Z" fill="#ffe14d" stroke="none" />
  </Svg>
);

export const PenIcon = (p: P) => (
  <Svg {...p}>
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </Svg>
);

export const BoxIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
  </Svg>
);

export const TrashIcon = (p: P) => (
  <Svg {...p}>
    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </Svg>
);

export const HandIcon = (p: P) => (
  <Svg {...p}>
    <path d="M18 11V6a2 2 0 0 0-4 0v1.5M14 11V4a2 2 0 0 0-4 0v2M10 10.5V5a2 2 0 0 0-4 0v7.5M6 14v-2a2 2 0 0 0-4 0v7a8 8 0 0 0 8 8h2a8 8 0 0 0 8-8v-6a2 2 0 0 0-4 0" />
  </Svg>
);

export const MinusIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);

export const PlusIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const FitIcon = (p: P) => (
  <Svg {...p}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
  </Svg>
);

export const UndoIcon = (p: P) => (
  <Svg {...p}>
    <path d="M3 7v6h6" />
    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
  </Svg>
);

export const RedoIcon = (p: P) => (
  <Svg {...p}>
    <path d="M21 7v6h-6" />
    <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
  </Svg>
);

export const GridIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
  </Svg>
);

export const DownloadIcon = (p: P) => (
  <Svg {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </Svg>
);

export const EraserIcon = (p: P) => (
  <Svg {...p}>
    <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
    <path d="M22 21H7" />
    <path d="m5 11 9 9" />
  </Svg>
);
