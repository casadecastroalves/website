// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://casadecastroalves.com.br',
  integrations: [sitemap()],
  redirects: {
    '/movimentoirun': '/movimento-irun',
    '/galeria': '/a-casa',
    '/eventos': '/shows',
  },
});
