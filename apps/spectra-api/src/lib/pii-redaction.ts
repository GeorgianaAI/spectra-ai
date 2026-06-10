const PII_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "email", pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g },
  // IBAN before phone_us so digit runs inside an IBAN are consumed first
  {
    label: "iban",
    pattern: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,6}(?:\s?[A-Z0-9]{1,4})?\b/g,
  },
  { label: "phone_us", pattern: /(\+?1[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}/g },
  // International phone — UK (+44) and common EU country codes (+33 FR, +49 DE, +34 ES, +39 IT, +31 NL)
  // Matches country code then 8–12 digits with optional separators
  {
    label: "phone_intl",
    pattern: /\+(?:44|33|49|34|39|31)[\s\-.]?\d[\d\s\-.]{6,13}\d/g,
  },
  { label: "ssn", pattern: /\b\d{3}[\s\-]\d{2}[\s\-]\d{4}\b/g },
  { label: "credit_card", pattern: /\b(?:\d{4}[\s\-]){3}\d{4}\b/g },
  { label: "uk_nino", pattern: /\b[A-Z]{2}\s?\d{6}\s?[A-D]\b/g },
  // DOB — US (MM/DD/YYYY or MM-DD-YYYY) and ISO (YYYY-MM-DD)
  {
    label: "dob",
    pattern: /\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](\d{2}|\d{4})\b/g,
  },
  {
    label: "dob_iso",
    pattern: /\b\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/g,
  },
  // Street address — number + street name + type
  {
    label: "address",
    pattern:
      /\b\d{1,5}\s+(?:[A-Za-z]+\s+){1,3}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl|Circle|Cir|Highway|Hwy|Parkway|Pkwy)\b\.?/gi,
  },
  // Contextual person names — requires a title/role prefix to avoid false positives
  {
    label: "person_name",
    pattern:
      /\b(?:Name|Patient|Client|Author|Signatory|Doctor|Dr|Mr|Mrs|Ms|Miss|Prof)\.?\s*:?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g,
  },
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
