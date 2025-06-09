//* eslint-disable @typescript-eslint/no-require-imports */

const eslint_JS = require('@eslint/js');
// const tslint = require('typescript-eslint');
const prettierConfig = require('eslint-config-prettier');
// const reactPlugin = require('eslint-plugin-react'); //The default export of eslint-plugin-react is a plugin object	//https://www.npmjs.com/package/eslint-plugin-react#plugin
const globals = require('globals');

module.exports = [
	eslint_JS.configs.recommended,
	// ...tslint.configs.recommended,
	// {
	// 	name: 'kaagzi/recommended-rules-with-ts-lint-override',
	// 	files: ['**/*.js'],
	// 	rules: {
	// 		// ...eslint_JS.configs.recommended.rules,

	// 		'no-console': [
	// 			'warn',
	// 			{
	// 				allow: ['warn', 'error'], //allow console.warn & console.error
	// 			},
	// 		],
	// 		'no-unused-vars': ['warn'], //override the one provided by '@eslint/js',
	// 	},
	// },
	{
		//name: 'kaagzi/recommended-rules-with-ts-js-lint-override',
		files: ['**/*.js'],
		rules: {
			'no-console': [
				'warn',
				{
					allow: ['warn', 'error'], //allow console.warn & console.error
				},
			],
			// '@typescript-eslint/no-unused-vars': ['warn'], //override the one provided by '@typescript-eslint',
		},
	},
	// {
	// 	files: ['**/*.{js,jsx,ts,tsx}'],
	// 	plugins: {
	// 		reactPlugin,
	// 	},
	// 	languageOptions: {
	// 		parserOptions: {
	// 			ecmaFeatures: {
	// 				jsx: true,
	// 			},
	// 		},
	// 		globals: {
	// 			...globals.browser,
	// 		},
	// 	},
	// 	rules: {
	// 		// ... any rules you want
	// 		'react/jsx-uses-react': 'error',
	// 		'react/jsx-uses-vars': 'error',
	// 	},
	// 	// ... others are omitted for brevity
	// },

	// reactPlugin.configs.flat.recommended, // This is not a plugin object, but a shareable config object
	// reactPlugin.configs.flat['jsx-runtime'], // Add this if you are using React 17+
	// //foll is used to remove the warning (no-unused) on the 'React' var in the stmt --> import React from 'react'
	// {
	// 	files: ['**/*.{jsx,tsx}'], //We limit to jsx and tsx since we shall only use those for react UI. by default it shall cover all script files js, jsx, ts, tsx, mjs, cjs etc
	// 	rules: {
	// 		'react/jsx-uses-react': 'error',
	// 		'react/jsx-uses-vars': 'error',
	// 	},
	// },
	{
		languageOptions: {
			globals: {
				// ...globals.browser, //browser globals such as -- conosle
				...globals.node, //nodejs globals such as -- module, require, console, process, __dirname
			},
		},
	},
	prettierConfig,
	{
		ignores: ['**/node_modules/', '.git/', '.cache/', 'build/'],
	},
];

// module.exports = tslint.config(
// 	eslint_JS.configs.recommended,
// 	tslint.configs.recommended,
// 	{
// 		rules: {
// 			//'no-unused-vars': ['warn'],
// 			'@typescript-eslint/no-unused-vars': ['warn'],
// 		},
// 	},
//	prettierConfig,
// 	// ...
// );
