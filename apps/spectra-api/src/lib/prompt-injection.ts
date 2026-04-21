const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /disregard\s+(all\s+)?previous\s+instructions/i,
  /forget\s+(everything|all)\s+(you|above)/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /new\s+instructions?\s*:/i,
  /system\s+prompt\s*:/i,
  /<\|im_start\|>/,
  /###\s*instruction/i,
  /act\s+as\s+if\s+you\s+(are|were)/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /override\s+(safety|security|guidelines)/i,
  /jailbreak/i,
  /\[INST\]/,
  /prompt\s+injection/i,
];

export interface InjectionCheckResult {
  safe: boolean;
  reason?: string;
}

export function detectPromptInjection(text: string): InjectionCheckResult {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return {
        safe: false,
        reason: `Potential prompt injection detected in uploaded content`,
      };
    }
  }
  return { safe: true };
}
