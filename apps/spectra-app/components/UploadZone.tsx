"use client";

import { useState, useRef, useCallback } from "react";
import { FileText, Aperture, AudioWaveform } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { UploadedFiles, Modality } from "@/lib/types";
import { ACCEPTED_FILE_TYPES } from "@/lib/constants";

interface UploadZoneProps {
  onUpload: (files: UploadedFiles) => void;
  disabled?: boolean;
}

const TARGETS: {
  key: Modality;
  label: string;
  sub: string;
  color: string;
  Icon: LucideIcon;
  accept: string;
}[] = [
  {
    key: "document",
    label: "Document",
    sub: "PDF · max 2 MB",
    color: "#2dd4bf",
    Icon: FileText,
    accept: ACCEPTED_FILE_TYPES.document.join(","),
  },
  {
    key: "vision",
    label: "Vision",
    sub: "JPG · PNG · WebP · max 1 MB",
    color: "#38bdf8",
    Icon: Aperture,
    accept: ACCEPTED_FILE_TYPES.vision.join(","),
  },
  {
    key: "audio",
    label: "Audio",
    sub: "MP3 · WAV · M4A · max 10 MB",
    color: "#f87171",
    Icon: AudioWaveform,
    accept: ACCEPTED_FILE_TYPES.audio.join(","),
  },
];

export default function UploadZone({ onUpload, disabled = false }: UploadZoneProps) {
  const [files, setFiles] = useState<UploadedFiles>({});
  const [dragging, setDragging] = useState<Modality | null>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const visionRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);

  const inputRefs: Record<Modality, React.RefObject<HTMLInputElement | null>> = {
    document: docRef,
    vision: visionRef,
    audio: audioRef,
  };

  const setFile = useCallback(
    (modality: Modality, file: File | null) => {
      setFiles((prev) => {
        const next = { ...prev };
        if (file) {
          next[modality] = file;
        } else {
          delete next[modality];
        }
        onUpload(next);
        return next;
      });
    },
    [onUpload],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, modality: Modality) => {
      e.preventDefault();
      setDragging(null);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) setFile(modality, file);
    },
    [disabled, setFile],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, modality: Modality) => {
      const file = e.target.files?.[0] ?? null;
      if (file) setFile(modality, file);
      e.target.value = "";
    },
    [setFile],
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.65rem" }}>
      {TARGETS.map(({ key, label, sub, color, Icon, accept }) => {
        const loaded = !!files[key];
        const active = dragging === key;
        return (
          <div
            key={key}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-label={`Upload ${label} file. ${files[key] ? `Selected: ${files[key]!.name}` : sub}`}
            aria-disabled={disabled}
            onClick={() => !disabled && inputRefs[key].current?.click()}
            onKeyDown={(e) => {
              if (!disabled && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                inputRefs[key].current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (!disabled) setDragging(key);
            }}
            onDragLeave={() => setDragging(null)}
            onDrop={(e) => handleDrop(e, key)}
            style={{
              position: "relative",
              border: `1.5px dashed ${loaded || active ? color : "rgba(255,255,255,0.1)"}`,
              borderRadius: "14px",
              padding: "1.25rem 0.75rem",
              textAlign: "center",
              cursor: disabled ? "not-allowed" : "pointer",
              background: loaded || active ? `${color}0d` : "rgba(255,255,255,0.02)",
              backdropFilter: "blur(10px)",
              transition: "border-color 0.2s, background 0.2s",
              opacity: disabled ? 0.5 : 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.55rem",
            }}
          >
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                background: `${color}15`,
                border: `1px solid ${color}30`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon size={17} color={color} strokeWidth={1.5} />
            </div>

            <div style={{ minWidth: 0, width: "100%" }}>
              <div
                style={{
                  color: "#fff",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  marginBottom: "0.2rem",
                }}
              >
                {label}
              </div>
              {files[key] ? (
                <div
                  style={{
                    color,
                    fontSize: "0.6rem",
                    fontFamily: "monospace",
                    wordBreak: "break-all",
                    lineHeight: 1.3,
                  }}
                >
                  {files[key]!.name}
                </div>
              ) : (
                <div
                  style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.6rem", lineHeight: 1.3 }}
                >
                  {sub}
                </div>
              )}
            </div>

            {files[key] && (
              <button
                type="button"
                aria-label={`Remove ${label} file`}
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!disabled) setFile(key, null);
                }}
                style={{
                  position: "absolute",
                  top: "7px",
                  right: "9px",
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.25)",
                  cursor: disabled ? "not-allowed" : "pointer",
                  fontSize: "0.75rem",
                  lineHeight: 1,
                  padding: "2px",
                  opacity: disabled ? 0.3 : 1,
                }}
              >
                ✕
              </button>
            )}

            <input
              ref={inputRefs[key]}
              type="file"
              accept={accept}
              aria-label={`Select ${label} file`}
              style={{ display: "none" }}
              onChange={(e) => handleChange(e, key)}
            />
          </div>
        );
      })}
    </div>
  );
}
