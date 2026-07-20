import tseslint from 'typescript-eslint'
import security from 'eslint-plugin-security'
import securityNode from 'eslint-plugin-security-node'
import xss from 'eslint-plugin-xss'

function eslintNinePlugin(plugin) {
  return {
    ...plugin,
    rules: Object.fromEntries(Object.entries(plugin.rules).map(([name, rule]) => [
      name,
      typeof rule === 'function' ? { create: rule } : rule,
    ])),
  }
}

export default [
  {
    files: ['src/**/*.{js,jsx,ts,tsx}', 'scripts/**/*.{js,mjs}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true }, ecmaVersion: 'latest', sourceType: 'module' },
    },
    plugins: {
      security,
      'security-node': eslintNinePlugin(securityNode),
      xss: eslintNinePlugin(xss),
    },
    rules: {
      ...security.configs.recommended.rules,
      ...securityNode.configs.recommended.rules,
      ...xss.configs.recommended.rules,
    },
  },
]
