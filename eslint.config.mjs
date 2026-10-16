import tsParser from '@typescript-eslint/parser'
export default [{files:['**/*.{js,jsx,ts,tsx}'],languageOptions:{parser:tsParser,parserOptions:{ecmaVersion:'latest',sourceType:'module',ecmaFeatures:{jsx:true}}},rules:{'no-debugger':'error','no-unreachable':'error'},ignores:['.next/**','node_modules/**','Prompt/.agents/**','Prompt/design-system/**']}]
