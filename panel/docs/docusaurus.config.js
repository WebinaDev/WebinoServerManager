// @ts-check
/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'WebinoServer API',
  url: 'https://docs.webina.local',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  i18n: { defaultLocale: 'en', locales: ['en', 'fa'] },
  presets: [
    [
      'classic',
      {
        docs: { routeBasePath: '/', sidebarPath: './sidebars.js' },
        blog: false,
        theme: { customCss: './src/css/custom.css' },
      },
    ],
  ],
};

module.exports = config;
