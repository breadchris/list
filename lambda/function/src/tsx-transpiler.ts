/**
 * TSX-to-JavaScript transpilation using esbuild
 * Ported from Go main.go buildAsESModule function
 */

import * as esbuild from 'esbuild';

export interface TranspileResult {
	success: boolean;
	compiledJS?: string;
	error?: string;
	errors?: TranspileError[];
	warnings?: TranspileError[];
}

export interface TranspileError {
	message: string;
	location?: {
		file: string;
		line: number;
		column: number;
		lineText?: string;
	};
}

/**
 * Transpile TSX source code to JavaScript ES module
 *
 * Configuration matches Go's buildAsESModule:
 * - Format: ESModule
 * - Target: ES2020
 * - JSX: Automatic with react import source
 * - External: react, react-dom, react/jsx-runtime, @supabase/supabase-js
 * - Sourcemap: inline
 * - Loader: TSX
 *
 * @param sourceCode - TSX source code to transpile
 * @param filename - Optional filename for better error messages (default: "component.tsx")
 * @returns TranspileResult with compiled JS or errors
 */
export async function transpileTSX(
	sourceCode: string,
	filename: string = 'component.tsx'
): Promise<TranspileResult> {
	try {
		// Note: esbuild.transform() doesn't support 'external' option - that's only for build()
		// External dependencies need to be handled in the browser via import maps or esm.sh
		const result = await esbuild.transform(sourceCode, {
			loader: 'tsx',
			format: 'esm',
			target: 'es2020',
			jsx: 'automatic',
			jsxImportSource: 'react',
			sourcemap: 'inline',
			sourcefile: filename,
			treeShaking: true,
			minifyWhitespace: false,
			minifyIdentifiers: false,
			minifySyntax: false,
			// TypeScript configuration matching Go implementation
			tsconfigRaw: {
				compilerOptions: {
					jsx: 'react-jsx',
					allowSyntheticDefaultImports: true,
					esModuleInterop: true,
					moduleResolution: 'node',
					target: 'ES2020',
					lib: ['ES2020', 'DOM', 'DOM.Iterable'],
					allowJs: true,
					skipLibCheck: true,
					strict: false,
					forceConsistentCasingInFileNames: true,
					noEmit: true,
					incremental: true,
					resolveJsonModule: true,
					isolatedModules: true
				}
			}
		});

		// Transform succeeds - warnings are in result.warnings
		const warnings = result.warnings && result.warnings.length > 0
			? result.warnings.map((warn: any) => ({
				message: warn.text,
				location: warn.location ? {
					file: warn.location.file,
					line: warn.location.line,
					column: warn.location.column,
					lineText: warn.location.lineText
				} : undefined
			}))
			: undefined;

		return {
			success: true,
			compiledJS: result.code,
			warnings
		};

	} catch (error: any) {
		console.error('TSX transpilation error:', error);

		// esbuild throws errors with detailed information
		const errors: TranspileError[] = [];

		if (error.errors && Array.isArray(error.errors)) {
			// esbuild error format
			errors.push(...error.errors.map((err: any) => ({
				message: err.text,
				location: err.location ? {
					file: err.location.file,
					line: err.location.line,
					column: err.location.column,
					lineText: err.location.lineText
				} : undefined
			})));
		} else {
			// Generic error
			errors.push({
				message: error.message || 'Unknown error'
			});
		}

		return {
			success: false,
			error: error.message || 'Transpilation failed',
			errors
		};
	}
}

/**
 * Validate TSX source code for basic syntax issues
 */
export function validateTSXSource(sourceCode: string): { valid: boolean; error?: string } {
	if (!sourceCode || sourceCode.trim().length === 0) {
		return { valid: false, error: 'Source code is empty' };
	}

	if (sourceCode.length > 1000000) {
		return { valid: false, error: 'Source code exceeds maximum size (1MB)' };
	}

	return { valid: true };
}
