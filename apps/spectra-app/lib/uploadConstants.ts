export type AllowedType = {
  modality: "document" | "image" | "audio";
  ext: string;
  maxBytes: number;
};

export const ALLOWED_TYPES: Record<string, AllowedType> = {
  "application/pdf": { modality: "document", ext: "pdf", maxBytes: 2 * 1024 * 1024 },
  "image/jpeg": { modality: "image", ext: "jpg", maxBytes: 1 * 1024 * 1024 },
  "image/png": { modality: "image", ext: "png", maxBytes: 1 * 1024 * 1024 },
  "image/webp": { modality: "image", ext: "webp", maxBytes: 1 * 1024 * 1024 },
  "image/gif": { modality: "image", ext: "gif", maxBytes: 1 * 1024 * 1024 },
  "audio/mpeg": { modality: "audio", ext: "mp3", maxBytes: 5 * 1024 * 1024 },
  "audio/mp4": { modality: "audio", ext: "m4a", maxBytes: 5 * 1024 * 1024 },
  "audio/mp4a": { modality: "audio", ext: "m4a", maxBytes: 5 * 1024 * 1024 },
  "audio/x-m4a": { modality: "audio", ext: "m4a", maxBytes: 5 * 1024 * 1024 },
  "audio/wav": { modality: "audio", ext: "wav", maxBytes: 5 * 1024 * 1024 },
  "audio/ogg": { modality: "audio", ext: "ogg", maxBytes: 5 * 1024 * 1024 },
  "audio/webm": { modality: "audio", ext: "webm", maxBytes: 5 * 1024 * 1024 },
};
