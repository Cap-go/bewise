import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  typescript: true,
  astro: false,
  rules: {
    // `slot="..."` targets the light-DOM slots of @capgo/capacitor-transitions web components.
    'vue/no-deprecated-slot-attribute': 'off',
  },
  ignores: ['**/dist/**', '**/ios/**', '**/android/**', '**/.astro/**', 'store/**', '**/*.md'],
})
