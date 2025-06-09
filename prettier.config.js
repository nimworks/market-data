/**
 * @see https://prettier.io/docs/en/configuration.html
 * @type {import("prettier").Config}
 */
const prtConfig = {
	arrowParens: 'always',
	bracketSameLine: false,
	bracketSpacing: true,
	semi: true,
	singleQuote: true,
	jsxSingleQuote: false,
	quoteProps: 'as-needed',
	trailingComma: 'all',
	singleAttributePerLine: false,
	htmlWhitespaceSensitivity: 'css',
	vueIndentScriptAndStyle: false,
	proseWrap: 'preserve',
	insertPragma: false,
	printWidth: 160,
	requirePragma: false,
	tabWidth: 4,
	useTabs: true,
	embeddedLanguageFormatting: 'auto',
	endOfLine: 'lf',
};

module.exports = prtConfig;
