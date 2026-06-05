const FILLER_WORDS = [
  /\bum+\b/gi,
  /\buh+\b/gi,
  /\bhmm+\b/gi,
  /\ber+\b/gi,
  /\buh-huh\b/gi,
  /\bmhm+\b/gi,
  /\byou know\b/gi,
  /\bi mean\b/gi,
  /\bkind of\b/gi,
  /\bsort of\b/gi,
  /\bbasically\b/gi,
  /\bactually\b/gi,
  /\bliterally\b/gi,
  /\bright\?\s*/gi,
  /\bokay so\b/gi,
  /\bso like\b/gi,
  /\blike,?\s+like\b/gi,
];

export function removeFillerWords(text: string): string {
  let cleaned = text;
  for (const pattern of FILLER_WORDS) {
    cleaned = cleaned.replace(pattern, '');
  }
  // Remove extra whitespace from removed words
  return cleaned.replace(/\s{2,}/g, ' ').replace(/^\s+|\s+$/g, '').trim();
}
