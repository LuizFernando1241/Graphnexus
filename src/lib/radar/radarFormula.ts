// Safe formula evaluator for pilares personalizados.
// Aceita: números, identificadores [a-zA-Z_][a-zA-Z0-9_]*, operadores + - * / ( ),
// espaços. Bloqueia qualquer outra coisa. Sem acesso a globals.

const SAFE_RE = /^[\s0-9+\-*/().a-zA-Z_]+$/

export function evalFormula(
  formula: string,
  vars: Record<string, number | null | undefined>,
): number | null {
  if (!formula || !formula.trim()) return null
  const src = formula.trim()
  if (!SAFE_RE.test(src)) return null

  const varNames = Object.keys(vars)
  const varValues = varNames.map((k) => {
    const v = vars[k]
    return typeof v === 'number' && isFinite(v) ? v : 0
  })

  // Se qualquer identificador usado não está mapeado, retorna null.
  const ids = new Set(src.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) ?? [])
  for (const id of ids) {
    if (!varNames.includes(id)) return null
  }

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(...varNames, `"use strict"; return (${src});`)
    const result = fn(...varValues) as unknown
    if (typeof result !== 'number' || !isFinite(result)) return null
    return result
  } catch {
    return null
  }
}

export function extractIdentifiers(formula: string): string[] {
  if (!formula) return []
  return Array.from(new Set(formula.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) ?? []))
}
