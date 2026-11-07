"use client";

import dynamic from "next/dynamic";

// A cena 3D só existe no navegador (WebGL), então não é renderizada no servidor.
const OfficeExperience = dynamic(() => import("@/components/office/OfficeExperience"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center bg-[#eceef2] text-sm text-[var(--muted)]">
      Montando o escritório...
    </div>
  ),
});

export default function EscritorioPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <OfficeExperience />
    </div>
  );
}
