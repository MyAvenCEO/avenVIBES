/**
 * The brand layer: how a `Brand` becomes CSS.
 *
 * Beside the runtime rather than in a package of its own, because they are one
 * framework. The guideline page this generates IS a `ViewDef`, and while the
 * two lived apart it had to be typed as an anonymous record and cast at the
 * call site — a contract neither half could name.
 *
 * Everything here is pure: no filesystem, no Node built-ins, safe in a browser
 * bundle. The build step that walks a source tree is `@myavenceo/aven-vibes/vite`
 * and is deliberately a separate entry point.
 */

/* The guideline page IS a view, so the type comes out with it — a consumer
   cannot annotate what it cannot name. */
export type { ViewDef } from '../types.js'
export { createGenerator, type Generator } from './generate.js'
export { createKitchenSink, type KitchenSink } from './kitchen-sink.js'
export {
	type ClassUse,
	scanCandidates,
	scanDeclaredClasses,
	scanFiles,
	scanSource
} from './scan.js'
export type { Audience, Brand, BrandScales, Decl, TokenMap } from './types.js'
export { assertNoShadowedTokens, colourNames, pieceNames } from './types.js'
export { createUtilities, type Utilities, type UtilityResult } from './utilities.js'
