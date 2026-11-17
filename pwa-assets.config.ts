import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Run `npm run icons` after changing public/logo.svg to regenerate all PWA icons.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#131316' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#131316' } },
  },
  images: ['public/logo.svg'],
});
