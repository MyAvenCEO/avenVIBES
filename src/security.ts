/** XSS / injection allowlists — ported from maia-engine security.js */

export const FORBIDDEN_PATH_KEYS = ['__proto__', 'constructor', 'prototype']

export const CSS_INJECTION_PATTERNS = [
	/javascript\s*:/i,
	/vbscript\s*:/i,
	/data\s*:\s*[^,]*base64\s*,/i,
	/expression\s*\(/i,
	/-moz-binding\s*:/i,
	/@import\b/i,
	/behavior\s*:/i
]

export const SAFE_TAGS = new Set([
	'div',
	'span',
	'p',
	'a',
	'button',
	'input',
	'textarea',
	'select',
	'option',
	'optgroup',
	'form',
	'label',
	'fieldset',
	'legend',
	'img',
	'picture',
	'source',
	'ul',
	'ol',
	'li',
	'dl',
	'dt',
	'dd',
	'table',
	'thead',
	'tbody',
	'tfoot',
	'tr',
	'th',
	'td',
	'caption',
	'colgroup',
	'col',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'header',
	'footer',
	'main',
	'nav',
	'section',
	'article',
	'aside',
	'details',
	'summary',
	'figure',
	'figcaption',
	'blockquote',
	'pre',
	'code',
	'em',
	'strong',
	'small',
	'sub',
	'sup',
	'mark',
	'del',
	'ins',
	'abbr',
	'time',
	'progress',
	'meter',
	'output',
	'dialog',
	'hr',
	'br'
])

export const BOOLEAN_ATTRS = new Set([
	'disabled',
	'readonly',
	'checked',
	'selected',
	'autofocus',
	'required',
	'multiple'
])

export const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'poster'])

export function sanitizeAttributeWhitelist(value: unknown): string {
	if (value === null || value === undefined) return ''
	const s = String(value)
	/*
	 * TYPOGRAPHY IS NOT AN INJECTION RISK, and this list treated it as one.
	 *
	 * It admitted the hyphen and nothing else from the dash family, so an
	 * accessible name written the way the copy is actually written — "Inbox
	 * router — one inbox for everything" — reached the page as "Inbox router
	 * one inbox for everything", losing the punctuation that separated the two
	 * halves. Every em-dash, curly apostrophe and ellipsis in every localised
	 * label went the same way, silently, because a stripped character throws
	 * nothing.
	 *
	 * What makes an attribute value dangerous is breaking OUT of it: the
	 * quote characters, the angle brackets, the backtick, and control
	 * characters. None of those are added here. `\p{Pd}` is the dash
	 * punctuation category, `\p{Pi}`/`\p{Pf}` the initial and final quotes
	 * (curly quotes and guillemets), and the three literals are the curly
	 * apostrophe, the ellipsis and the non-breaking space that German and
	 * French copy both need.
	 */
	return s.replace(/[^\p{L}\p{N}\s.,!?_:;@#()+=[\]~&%/\p{Pd}\p{Pi}\p{Pf}\u2019\u2026\u00a0-]/gu, '')
}

export function sanitizePayloadForValidation(payload: unknown): unknown {
	if (!payload || typeof payload !== 'object') return payload
	if (Array.isArray(payload)) return payload.map(sanitizePayloadForValidation)
	const result: Record<string, unknown> = {}
	for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
		if (v != null && typeof v === 'object' && !Array.isArray(v)) {
			result[k] = sanitizePayloadForValidation(v)
		} else {
			result[k] = v
		}
	}
	return result
}
