/**
 * Client-side secret / credential pattern scan for Problems panel.
 */

const RULES = [
  {
    id: 'aws-access-key',
    message: 'Possible AWS access key id',
    re: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    id: 'aws-secret',
    message: 'Possible AWS secret access key assignment',
    re: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[=:]\s*['"]?[A-Za-z0-9/+=]{30,}/gi,
  },
  {
    id: 'private-key',
    message: 'Private key block detected',
    re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
  },
  {
    id: 'github-pat',
    message: 'Possible GitHub personal access token',
    re: /\bghp_[A-Za-z0-9]{36,}\b/g,
  },
  {
    id: 'github-oauth',
    message: 'Possible GitHub OAuth/token',
    re: /\bgho_[A-Za-z0-9]{36,}\b/g,
  },
  {
    id: 'slack-token',
    message: 'Possible Slack token',
    re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  },
  {
    id: 'openai-sk',
    message: 'Possible OpenAI / OpenRouter API key',
    re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    id: 'stripe-key',
    message: 'Possible Stripe secret key',
    re: /\bsk_live_[A-Za-z0-9]{16,}\b/g,
  },
  {
    id: 'generic-secret-assign',
    message: 'Hardcoded secret-looking assignment',
    re: /(?:api[_-]?key|secret|password|token)\s*[=:]\s*['"][^'"]{12,}['"]/gi,
  },
];

/**
 * @param {string} content
 * @returns {{ line: number, column: number, endColumn: number, message: string, ruleId: string }[]}
 */
export function scanSecrets(content) {
  const text = String(content ?? '');
  if (!text || text.length > 2_000_000) return [];
  const lines = text.split('\n');
  const hits = [];

  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let m;
    // Use matchAll on full text then map to line/col
    const copy = new RegExp(rule.re.source, rule.re.flags.includes('g') ? rule.re.flags : `${rule.re.flags}g`);
    for (const match of text.matchAll(copy)) {
      const idx = match.index ?? 0;
      let line = 1;
      let col = 1;
      let acc = 0;
      for (let i = 0; i < lines.length; i += 1) {
        const len = lines[i].length + 1;
        if (acc + len > idx) {
          line = i + 1;
          col = idx - acc + 1;
          break;
        }
        acc += len;
      }
      const matched = match[0] || '';
      hits.push({
        line,
        column: col,
        endColumn: col + matched.length,
        message: rule.message,
        ruleId: rule.id,
      });
      if (hits.length >= 50) return hits;
    }
  }
  return hits;
}

/**
 * Monaco severity Warning = 4
 */
export function toMonacoMarkers(hits, monaco) {
  const Severity = monaco?.MarkerSeverity?.Warning ?? 4;
  return hits.map((h) => ({
    severity: Severity,
    message: `[secret] ${h.message}`,
    startLineNumber: h.line,
    startColumn: h.column,
    endLineNumber: h.line,
    endColumn: Math.max(h.column + 1, h.endColumn),
    source: 'orion-secrets',
  }));
}
