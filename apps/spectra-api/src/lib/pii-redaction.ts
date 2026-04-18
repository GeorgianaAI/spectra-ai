const PII_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'email', pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g },
  { label: 'phone_us', pattern: /(\+?1[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}/g },
  { label: 'ssn', pattern: /\b\d{3}[\s\-]\d{2}[\s\-]\d{4}\b/g },
  { label: 'credit_card', pattern: /\b(?:\d{4}[\s\-]){3}\d{4}\b/g },
  { label: 'uk_nino', pattern: /\b[A-Z]{2}\s?\d{6}\s?[A-D]\b/g },
];

export interface RedactionResult {
  text: string;
  redactedFields: string[];
}

export function redactPii(input: string): RedactionResult {
  let text = input;
  const redactedFields: string[] = [];

  for (const { label, pattern } of PII_PATTERNS) {
    const before = text;
    text = text.replace(pattern, `[REDACTED:${label.toUpperCase()}]`);
    if (text !== before && !redactedFields.includes(label)) {
      redactedFields.push(label);
    }
  }

  return { text, redactedFields };
}
