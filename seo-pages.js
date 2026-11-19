// Renders the static SEO pages defined in src/content/seoPages.js into standalone HTML.
// Used by vite-plugin-seo.js: emitted as <slug>/index.html at build time, served directly
// in dev. The pages need no JavaScript, so they load fast and every crawler can read them.
// Styling mirrors the app's design tokens (src/styles/theme.css, DESIGN.md).

const NAME = 'RandomChatly';

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Escape "<" so the JSON can never close the surrounding <script> tag. */
export const safeJson = (value) => JSON.stringify(value, null, 2).replace(/</g, '\\u003c');

export const pagePath = (slug) => `/${slug}/`;

/** Microsoft Clarity tracking snippet (analytics, heatmaps, session recordings). */
export const clarityScript = (id) =>
  `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};` +
  `t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;` +
  `y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);` +
  `})(window, document, "clarity", "script", ${JSON.stringify(id)});`;

const STYLES = `
  :root {
    color-scheme: dark;
    --bg: #1a1019; --card: #21141f; --line: #352131;
    --accent: #f07289; --accent-hover: #f4889b; --accent-ink: #2a0a12; --accent-line: rgba(240,114,137,.45);
    --text: #f5ecef; --text-2: #c9b6bf; --text-3: #a8939e;
    --display: Outfit, -apple-system, BlinkMacSystemFont, sans-serif;
    --body: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  }
  * { box-sizing: border-box; margin: 0; }
  body { background: var(--bg); color: var(--text); font-family: var(--body); line-height: 1.6; -webkit-font-smoothing: antialiased; }
  a { color: inherit; }
  .wrap { max-width: 680px; margin: 0 auto; padding: 0 16px; }
  header.site { position: sticky; top: 0; z-index: 5; background: rgba(26,16,25,.92); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); }
  header.site .wrap { display: flex; align-items: center; justify-content: space-between; gap: 12px; height: 60px; }
  .brand { font-family: var(--display); font-weight: 800; font-size: 1.25rem; letter-spacing: -.02em; color: var(--accent); text-decoration: none; }
  .btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 20px; border-radius: 999px;
    background: var(--accent); color: var(--accent-ink); font-family: var(--display); font-weight: 600; font-size: 1rem; text-decoration: none; }
  .btn:hover { background: var(--accent-hover); }
  .btn:focus-visible, a:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
  main { padding: 28px 0 56px; }
  nav.crumbs { font-size: .8125rem; color: var(--text-3); }
  nav.crumbs a { color: var(--text-3); }
  h1 { margin-top: 12px; font-family: var(--display); font-size: clamp(1.9rem, 6vw, 2.5rem); line-height: 1.1; letter-spacing: -.02em; text-wrap: balance; }
  .intro { margin-top: 14px; font-size: 1.0625rem; color: var(--text-2); }
  section { margin-top: 40px; }
  h2 { font-family: var(--display); font-size: 1.25rem; line-height: 1.25; letter-spacing: -.01em; }
  h3 { font-family: var(--display); font-size: 1rem; font-weight: 600; }
  section p, section li { color: var(--text-2); font-size: .9375rem; }
  section p { margin-top: 10px; }
  ul.list { margin-top: 12px; padding-left: 20px; display: grid; gap: 8px; }
  ul.list li::marker { color: var(--accent); }
  ol.steps { list-style: none; padding: 0; margin-top: 16px; display: grid; gap: 18px; }
  ol.steps li { display: grid; grid-template-columns: 32px 1fr; gap: 14px; }
  ol.steps .num { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; font-family: var(--display);
    font-weight: 700; font-size: .875rem; color: var(--accent); border: 1.5px solid var(--accent-line); }
  ol.steps p { margin-top: 2px; color: var(--text-3); }
  .faq details { border-bottom: 1px solid var(--line); }
  .faq summary { list-style: none; cursor: pointer; padding: 16px 0; display: flex; justify-content: space-between; align-items: center; gap: 16px; }
  .faq summary::-webkit-details-marker { display: none; }
  .faq summary::after { content: '+'; display: inline-block; flex-shrink: 0; font-size: 1.25rem; line-height: 1; color: var(--text-3); transition: transform .2s ease; }
  .faq details[open] summary::after { transform: rotate(45deg); }
  .faq details p { margin: 0; padding-bottom: 16px; color: var(--text-3); font-size: .9375rem; }
  .cta { margin-top: 48px; padding: 24px; border: 1px solid var(--line); border-radius: 16px; background: var(--card); }
  .cta p { margin: 6px 0 18px; color: var(--text-2); font-size: .9375rem; }
  footer.site { border-top: 1px solid var(--line); padding: 28px 0 40px; font-size: .875rem; color: var(--text-3); }
  footer.site ul { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 8px 20px; margin-bottom: 16px; }
  footer.site a { color: var(--text-2); text-decoration: none; }
  footer.site a:hover, nav.crumbs a:hover { text-decoration: underline; }
  footer.site a[aria-current="page"] { color: var(--accent); }
  @media (prefers-reduced-motion: reduce) { .faq summary::after { transition: none; } }
`;

function renderSection(section) {
  let body = '';
  if (section.paragraphs) body += section.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('');
  if (section.list) body += `<ul class="list">${section.list.map((li) => `<li>${esc(li)}</li>`).join('')}</ul>`;
  if (section.steps) {
    body += `<ol class="steps">${section.steps
      .map(
        (s, i) =>
          `<li><span class="num" aria-hidden="true">${i + 1}</span><div><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></div></li>`
      )
      .join('')}</ol>`;
  }
  return `<section><h2>${esc(section.heading)}</h2>${body}</section>`;
}

function renderFaq(items) {
  return `<section class="faq">${items
    .map((q) => `<details><summary><h2>${esc(q.question)}</h2></summary><p>${esc(q.answer)}</p></details>`)
    .join('')}</section>`;
}

/**
 * @param {object} page  one entry of SEO_PAGES
 * @param {object[]} allPages  every entry, for the footer links
 * @param {string} site  absolute origin without trailing slash, or '' when unknown
 */
/** Google Analytics 4 (gtag.js) tags: the loader plus the config call. */
export const gaTags = (id) => [
  { src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}` },
  {
    inline:
      `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}` +
      `gtag('js',new Date());gtag('config',${JSON.stringify(id)});`,
  },
];

export function renderSeoPage(page, allPages, site, clarityId, gaId) {
  const path = pagePath(page.slug);
  const url = site ? `${site}${path}` : '';
  const image = site ? `${site}/og-image.png` : '';
  const fullTitle = `${page.title} | ${NAME}`;

  const graph = [
    {
      '@type': 'WebPage',
      name: page.title,
      description: page.description,
      inLanguage: 'en',
      ...(url && { url, isPartOf: { '@id': `${site}/#website` } }),
    },
  ];
  if (site) {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: NAME, item: `${site}/` },
        { '@type': 'ListItem', position: 2, name: page.navLabel, item: url },
      ],
    });
  }
  if (page.faq) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: page.faq.map(({ question, answer }) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer },
      })),
    });
  }

  const head = [
    '<meta charset="UTF-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover" />',
    `<title>${esc(fullTitle)}</title>`,
    `<meta name="description" content="${esc(page.description)}" />`,
    '<meta name="robots" content="index, follow, max-image-preview:large" />',
    '<meta name="theme-color" content="#1a1019" />',
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
    '<link rel="manifest" href="/manifest.webmanifest" />',
    url && `<link rel="canonical" href="${url}" />`,
    '<meta property="og:type" content="article" />',
    `<meta property="og:site_name" content="${NAME}" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    url && `<meta property="og:url" content="${url}" />`,
    image && `<meta property="og:image" content="${image}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    image && `<meta name="twitter:image" content="${image}" />`,
    '<link rel="preconnect" href="https://fonts.googleapis.com" />',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500&display=swap" />',
    `<style>${STYLES}</style>`,
    `<script type="application/ld+json">${safeJson({ '@context': 'https://schema.org', '@graph': graph })}</script>`,
    clarityId && `<script>${clarityScript(clarityId)}</script>`,
    ...(gaId
      ? gaTags(gaId).map((t) => (t.src ? `<script async src="${t.src}"></script>` : `<script>${t.inline}</script>`))
      : []),
  ]
    .filter(Boolean)
    .join('\n    ');

  const footerLinks = [
    `<li><a href="/">Random chat</a></li>`,
    ...allPages.map(
      (p) =>
        `<li><a href="${pagePath(p.slug)}"${p.slug === page.slug ? ' aria-current="page"' : ''}>${esc(p.navLabel)}</a></li>`
    ),
  ].join('');

  return `<!doctype html>
<html lang="en">
  <head>
    ${head}
  </head>
  <body>
    <header class="site"><div class="wrap">
      <a class="brand" href="/">${NAME}</a>
      <a class="btn" href="/">Start chatting</a>
    </div></header>
    <main class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">${NAME}</a> / <span aria-current="page">${esc(page.navLabel)}</span></nav>
      <h1>${esc(page.h1)}</h1>
      <p class="intro">${esc(page.intro)}</p>
      ${page.sections.map(renderSection).join('\n      ')}
      ${page.faq ? renderFaq(page.faq) : ''}
      <aside class="cta">
        <h2>Ready to meet someone new?</h2>
        <p>Free, anonymous one-on-one chat. No signup needed.</p>
        <a class="btn" href="/">Start a random chat</a>
      </aside>
    </main>
    <footer class="site"><div class="wrap">
      <nav aria-label="More about ${NAME}"><ul>${footerLinks}</ul></nav>
      <p>${NAME}: random chat with strangers who could become friends.</p>
    </div></footer>
  </body>
</html>
`;
}
