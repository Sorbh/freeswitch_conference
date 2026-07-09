#!/usr/bin/env node
/**
 * Blog build script — reads markdown files from content/blog/,
 * generates blogRegistry.js (client) and blog-ssr-data.json (server).
 *
 * Run: node scripts/build-blog.mjs
 * Runs automatically as part of: npm run build
 *
 * To add a new blog post:
 *   1. Create a .md file in content/blog/{category}/
 *   2. Add frontmatter (title, description, date, readTime, author, etc.)
 *   3. Run this script (or npm run build)
 *   4. If the post needs custom JSX, set `component: ComponentName` in frontmatter
 *      and create the component in FeaturePages.jsx
 *   5. If the post is pure markdown (no component), it renders via the generic BlogPost component
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'blog');
const REGISTRY_OUT = path.join(ROOT, 'client', 'src', 'pages', 'landing2', 'blogRegistry.js');
const SSR_OUT = path.join(ROOT, 'data', 'blog-ssr-data.json');

const CATEGORIES = {
  guides: { label: 'Industry Guides', description: 'How-to guides and explainers for the auto dismantler industry' },
  news: { label: 'Network Updates', description: 'New rooms, milestones, and member stories from the Hotline HQ network' },
  market: { label: 'Parts Market', description: 'Popular parts, seasonal trends, and pricing insights from 500+ yards' },
};

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const raw = match[1];
  const body = match[2].trim();
  const meta = {};
  let currentKey = null;
  let currentList = null;
  let currentObj = null;

  for (const line of raw.split('\n')) {
    const listItemMatch = line.match(/^  - (.+)$/);
    const nestedKvMatch = line.match(/^    (\w+): (.+)$/);
    const topKvMatch = line.match(/^(\w+): (.+)$/);

    if (nestedKvMatch && currentList && currentObj) {
      currentObj[nestedKvMatch[1]] = nestedKvMatch[2].trim();
    } else if (listItemMatch && currentList) {
      if (currentObj && Object.keys(currentObj).length > 0) {
        currentList.push(currentObj);
      }
      const val = listItemMatch[1].trim();
      const inlineKv = val.match(/^(\w+): (.+)$/);
      if (inlineKv) {
        currentObj = { [inlineKv[1]]: inlineKv[2].trim() };
      } else {
        currentList.push(val);
        currentObj = null;
      }
    } else if (topKvMatch) {
      if (currentList && currentObj && Object.keys(currentObj).length > 0) {
        currentList.push(currentObj);
      }
      currentObj = null;
      currentList = null;
      currentKey = topKvMatch[1];
      meta[currentKey] = topKvMatch[2].trim();
    } else if (line.match(/^(\w+):$/)) {
      if (currentList && currentObj && Object.keys(currentObj).length > 0) {
        currentList.push(currentObj);
      }
      currentKey = line.replace(':', '').trim();
      currentList = [];
      currentObj = null;
      meta[currentKey] = currentList;
    }
  }
  if (currentList && currentObj && Object.keys(currentObj).length > 0) {
    currentList.push(currentObj);
  }

  return { meta, body };
}

function markdownToHtml(md) {
  let html = md;

  // Tables
  html = html.replace(/^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)+)/gm, (_, header, sep, rows) => {
    const ths = header.split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
    const trs = rows.trim().split('\n').map(row => {
      const tds = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${tds}</tr>`;
    }).join('');
    return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
  });

  // Headings with IDs
  html = html.replace(/^## (.+?) \{#([\w-]+)\}$/gm, '<h2 id="$2">$1</h2>');
  html = html.replace(/^### (.+?) \{#([\w-]+)\}$/gm, '<h3 id="$2">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Ordered lists
  html = html.replace(/^(\d+\. .+(?:\n(?!\n).*)*)/gm, (match) => {
    const items = match.split(/\n(?=\d+\. )/).map(li => `<li>${li.replace(/^\d+\. /, '').trim()}</li>`).join('');
    return `<ol>${items}</ol>`;
  });

  // Unordered lists
  html = html.replace(/^(- .+(?:\n(?!\n)(?:- .+|  .+))*)/gm, (match) => {
    const items = match.split(/\n(?=- )/).map(li => `<li>${li.replace(/^- /, '').trim()}</li>`).join('');
    return `<ul>${items}</ul>`;
  });

  // Paragraphs
  html = html.split('\n\n').map(block => {
    block = block.trim();
    if (!block) return '';
    if (block.startsWith('<')) return block;
    return `<p>${block}</p>`;
  }).join('\n');

  return html;
}

function scanPosts() {
  const posts = [];

  for (const category of Object.keys(CATEGORIES)) {
    const catDir = path.join(CONTENT_DIR, category);
    if (!fs.existsSync(catDir)) continue;

    const files = fs.readdirSync(catDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const slug = file.replace(/\.md$/, '');
      const content = fs.readFileSync(path.join(catDir, file), 'utf8');
      const { meta, body } = parseFrontmatter(content);

      posts.push({
        slug,
        category,
        title: meta.title || slug,
        description: meta.description || '',
        date: meta.date || '2026-01-01',
        readTime: meta.readTime || '5 min read',
        author: meta.author || 'Hotline HQ Team',
        authorRole: meta.authorRole || '',
        keywords: meta.keywords || '',
        component: meta.component || null,
        toc: Array.isArray(meta.toc) ? meta.toc : [],
        faq: Array.isArray(meta.faq) ? meta.faq : [],
        bodyHtml: markdownToHtml(body),
      });
    }
  }

  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

function generateRegistry(posts) {
  const lines = [
    '// AUTO-GENERATED by scripts/build-blog.mjs — do not edit manually',
    `// Generated: ${new Date().toISOString()}`,
    '',
    `export const BLOG_CATEGORIES = ${JSON.stringify(CATEGORIES, null, 2)};`,
    '',
    'export const BLOG_POSTS = [',
  ];

  for (const p of posts) {
    lines.push(`  {`);
    lines.push(`    slug: ${JSON.stringify(p.slug)},`);
    lines.push(`    category: ${JSON.stringify(p.category)},`);
    lines.push(`    title: ${JSON.stringify(p.title)},`);
    lines.push(`    description: ${JSON.stringify(p.description)},`);
    lines.push(`    date: ${JSON.stringify(p.date)},`);
    lines.push(`    readTime: ${JSON.stringify(p.readTime)},`);
    lines.push(`    author: { name: ${JSON.stringify(p.author)}, role: ${JSON.stringify(p.authorRole)} },`);
    if (p.component) lines.push(`    component: ${JSON.stringify(p.component)},`);
    lines.push(`  },`);
  }

  lines.push('];');
  lines.push('');
  lines.push('export function getPostsByCategory(category) {');
  lines.push('  return BLOG_POSTS.filter(p => p.category === category).sort((a, b) => b.date.localeCompare(a.date));');
  lines.push('}');
  lines.push('');
  lines.push('export function getPostUrl(post) {');
  lines.push('  return `/blog/${post.category}/${post.slug}`;');
  lines.push('}');
  lines.push('');
  lines.push('export function getCategoryUrl(category) {');
  lines.push('  return `/blog/${category}`;');
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

function generateSsrData(posts) {
  const data = {
    categories: CATEGORIES,
    posts: posts.map(p => ({
      slug: p.slug,
      category: p.category,
      title: p.title,
      description: p.description,
      date: p.date,
      readTime: p.readTime,
      author: p.author,
      authorRole: p.authorRole,
      keywords: p.keywords,
      component: p.component,
      toc: p.toc,
      faq: p.faq,
      bodyHtml: p.bodyHtml,
    })),
  };
  return JSON.stringify(data, null, 2);
}

// Main
const posts = scanPosts();
console.log(`[blog] Found ${posts.length} post(s) across ${Object.keys(CATEGORIES).length} categories`);

fs.writeFileSync(REGISTRY_OUT, generateRegistry(posts));
console.log(`[blog] Generated ${path.relative(ROOT, REGISTRY_OUT)}`);

fs.writeFileSync(SSR_OUT, generateSsrData(posts));
console.log(`[blog] Generated ${path.relative(ROOT, SSR_OUT)}`);

// Update sitemap
const sitemapPath = path.join(ROOT, 'public', 'sitemap.xml');
if (fs.existsSync(sitemapPath)) {
  let sitemap = fs.readFileSync(sitemapPath, 'utf8');
  for (const p of posts) {
    const url = `https://hotlinehq.online/blog/${p.category}/${p.slug}`;
    if (!sitemap.includes(url)) {
      const entry = `  <url>\n    <loc>${url}</loc>\n    <lastmod>${p.date}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
      sitemap = sitemap.replace('</urlset>', `${entry}\n</urlset>`);
      console.log(`[blog] Added ${url} to sitemap`);
    }
  }
  fs.writeFileSync(sitemapPath, sitemap);
}

console.log('[blog] Done');
