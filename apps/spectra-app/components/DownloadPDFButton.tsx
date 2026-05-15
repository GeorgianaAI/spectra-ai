"use client";

import { FileDown } from "lucide-react";
import { COLORS } from "@/lib/theme";

interface DownloadPDFButtonProps {
  onClick: () => void;
}

export default function DownloadPDFButton({ onClick }: DownloadPDFButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Download synthesis as PDF"
      aria-label="Download synthesis as PDF"
      style={{
        marginLeft: "auto",
        background: "none",
        border: `1px solid ${COLORS.accent}40`,
        borderRadius: "4px",
        padding: "4px 10px",
        color: `${COLORS.accent}cc`,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "5px",
        fontSize: "0.65rem",
        fontFamily: "monospace",
        fontWeight: 700,
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        transition: "border-color 0.15s, color 0.15s",
      }}
    >
      <FileDown size={13} />
      PDF
    </button>
  );
}
