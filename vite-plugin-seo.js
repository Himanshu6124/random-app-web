// Build-time SEO for RandoMeet.
//
// Search engines and social apps need absolute URLs (canonical link, og:url, og:image,
// sitemap), which depend on the production domain. Set VITE_SITE_URL (for example
// https://randomeet.app) in the build environment and this plugin adds:
//   - <link rel="canonical">, og:url, og:image and twitter:image in index.html
//   - JSON-LD structured data (WebSite + WebApplication + FAQPage)
//   - robots.txt and sitemap.xml in the build output
// It also builds the static content pages from src/content/seoPages.js (/faq/, /safety/, ...)
// as <slug>/index.html, and serves them in dev.
// Without VITE_SITE_URL the build still works: robots.txt is emitted without a sitemap
// line, pages have no canonical URL, and the build prints a warning.

import { FAQ } from './src/content/landingContent.js';
import { SEO_PAGES } from './src/content/seoPages.js';
import { renderSeoPage, pagePath, safeJson } from './seo-pages.js';

const NAME = 'RandoMeet';
const DESCRIPTION =
  'Free random chat with strangers. Talk to strangers in an anonymous one-on-one text chat, no signup needed, and turn the people you click with into friends.';
const OG_IMAGE = '/og-image.png';

export function seo({ siteUrl } = {}) {
  const site = siteUrl ? siteUrl.trim().replace(/\/+$/, '') : '';
  let isBuild = false;

  return {
    name: 'randomeet-seo',

    configResolved(config) {
      isBuild = config.command === 'build';
      if (isBuild && !site) {
        config.logger.warn(
          '\n[seo] VITE_SITE_URL is not set: canonical URL, share image, structured data and sitemap.xml are skipped.\n'
        );
      }
    },

    // Dev: answer /faq, /faq/ etc. with the rendered page before Vite's SPA fallback.
    // Content is re-read on every request, so copy edits show up on reload.
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || '').split('?')[0].replace(/\/+$/, '');
        if (!path || path.includes('.')) return next();
        try {
          const { SEO_PAGES: pages } = await server.ssrLoadModule('/src/content/seoPages.js');
          const page = pages.find((p) => `/${p.slug}` === path);
          if (!page) return next();
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(renderSeoPage(page, pages, site));
        } catch (err) {
          next(err);
        }
      });
    },

    transformIndexHtml() {
      if (!site) return [];
      const home = `${site}/`;
      const image = `${site}${OG_IMAGE}`;

      const structuredData = {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebSite',
            '@id': `${home}#website`,
            name: NAME,
            url: home,
            inLanguage: 'en',
          },
          {
            '@type': 'WebApplication',
            '@id': `${home}#app`,
            name: NAME,
            url: home,
            description: DESCRIPTION,
            applicationCategory: 'SocialNetworkingApplication',
            operatingSystem: 'Any',
            browserRequirements: 'Requires JavaScript',
            image,
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          },
          {
            // Mirrors the FAQ shown on the landing page (same source file)
            '@type': 'FAQPage',
            '@id': `${home}#faq`,
            mainEntity: FAQ.items.map(({ question, answer }) => ({
              '@type': 'Question',
              name: question,
              acceptedAnswer: { '@type': 'Answer', text: answer },
            })),
          },
        ],
      };

      return [
        { tag: 'link', attrs: { rel: 'canonical', href: home }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:url', content: home }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:image', content: image }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'twitter:image', content: image }, injectTo: 'head' },
        {
          tag: 'script',
          attrs: { type: 'application/ld+json' },
          children: safeJson(structuredData),
          injectTo: 'head',
        },
      ];
    },

    generateBundle() {
      const robots = ['User-agent: *', 'Allow: /', ''];
      if (site) robots.push(`Sitemap: ${site}/sitemap.xml`, '');
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots.join('\n') });

      for (const page of SEO_PAGES) {
        this.emitFile({
          type: 'asset',
          fileName: `${page.slug}/index.html`,
          source: renderSeoPage(page, SEO_PAGES, site),
        });
      }

      if (site) {
        const today = new Date().toISOString().slice(0, 10);
        const paths = ['/', ...SEO_PAGES.map((p) => pagePath(p.slug))];
        const sitemap = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...paths.map((p) => `  <url>\n    <loc>${site}${p}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`),
          '</urlset>',
          '',
        ].join('\n');
        this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap });
      }
    },
  };
}
