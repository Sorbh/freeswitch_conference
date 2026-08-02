# Blog Content Guide

How to create, format, and publish blog posts for Hotline HQ.

## Directory Structure

```
content/blog/
├── guides/          # Industry Guides
├── news/            # Network Updates
├── market/          # Parts Market
└── yard-growth/     # Yard Growth
```

Each category maps to `/blog/{category}/{slug}` on the site.

Images go in `public/images/blog/{slug}/` as optimized `.webp` files.

## Frontmatter Format

Every `.md` file in a category folder needs YAML frontmatter. Here is the required format:

```yaml
---
title: "Your Blog Post Title — With a Compelling Subtitle"
description: "One to two sentence meta description for SEO. Include primary keyword. 150-160 characters."
date: 2026-07-20
readTime: "8 min read"
author: "Hotline HQ Team"
authorRole: "The team behind the largest voice parts network in the US"
coverImage: "/images/blog/your-post-slug/hero-image.webp"
coverImageAlt: "Descriptive alt text for the hero image"
ogImage: "/images/blog/your-post-slug/hero-image.webp"
keywords:
  - primary keyword
  - secondary keyword
  - long tail keyword
toc:
  - id: section-id
    label: Section Display Name
  - id: another-section
    label: Another Section Name
faq:
  - q: "What is the first question?"
    a: "Answer to the first question with sources if applicable."
  - q: "What is the second question?"
    a: "Answer to the second question."
---
```

### Critical Field Names

The build script normalizes some field names, but use these canonical names to avoid issues:

| Field | Use This | Also Accepted | DO NOT Use |
|-------|----------|---------------|------------|
| TOC entries | `label` | `title` | `name`, `text` |
| FAQ question | `q` | `question` | `query` |
| FAQ answer | `a` | `answer` | `response` |

### Required Fields

- `title` — Page title and H1
- `description` — Meta description (SEO)
- `date` — Publish date (`YYYY-MM-DD`)
- `coverImage` — Hero image path (must exist in `public/`)
- `coverImageAlt` — Alt text for hero image
- `keywords` — Array of target keywords

### Optional Fields

- `lastUpdated` — Date of last content update
- `readTime` — Estimated read time string
- `ogImage` — Open Graph image (defaults to `coverImage`)
- `component` — Custom React component name (rare)
- `cluster` — Cluster name for topic grouping
- `cluster_role` — `pillar` or `spoke`
- `cluster_group` — Cluster sub-group name
- `toc` — Table of contents entries (shows in sidebar)
- `faq` — FAQ entries (renders as accordion + FAQPage schema)

## Markdown Body

The build pipeline (`scripts/build-blog.mjs`) converts markdown to HTML. Supported syntax:

### Headings (with anchor IDs)

```markdown
## Section Title {#section-id}

### Subsection Title {#sub-id}
```

The `{#id}` must match a `toc` entry's `id` for the sidebar to link correctly.

### Images

```markdown
![Alt text describing the image](/images/blog/your-post-slug/image-name.webp)
```

DO NOT use `[IMAGE: ...]` placeholder markers — those render as literal text. Always use standard markdown image syntax.

### Links

```markdown
[Link text](https://example.com)
[Internal link](/blog/guides/another-post)
```

### Tables

```markdown
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data     | Data     | Data     |
```

### Blockquotes / Callouts

```markdown
> **Key Takeaways**
> - First takeaway point
> - Second takeaway point
```

### Lists

```markdown
1. Ordered item one
2. Ordered item two

- Unordered item
- Another item
```

### Bold / Italic

```markdown
**bold text**
*italic text*
```

## Images

### Specifications

| Type | Dimensions | Quality | Max Size | Format |
|------|-----------|---------|----------|--------|
| Hero/Cover | 1200x630 | 82 | 150 KB | WebP |
| Inline | 800x450 | 80 | 100 KB | WebP |
| OG/Social | 1200x630 | 78 | 80 KB | WebP |

### Optimization

After generating or placing a raw image, optimize with:

```bash
# Hero image
node ~/.claude/skills/blog-image/scripts/optimize-images.mjs path/to/image.jpg --hero

# Inline image
node ~/.claude/skills/blog-image/scripts/optimize-images.mjs path/to/image.jpg --inline
```

### Generation

Use the `/blog-image` skill to generate images via Gemini:

```bash
agy --add-dir . -p "/nanobanana:generate <detailed prompt>. Aspect ratio 16:9."
```

Images save to `~/.gemini/antigravity-cli/brain/` or `~/.gemini/antigravity-cli/scratch/`. Copy to the target directory and optimize.

Rate limit: ~15 seconds between generations. Daily quota resets at ~09:47 UTC.

## Build & Deploy

```bash
# Build blog registry + frontend (no server restart)
node scripts/build-blog.mjs && cd client && npm run build && cd ..

# Full deploy (includes prerender + pm2 restart for SSR)
npm run deploy
```

The build pipeline:
1. `scripts/build-blog.mjs` — Scans `content/blog/`, generates `client/src/pages/landing2/blogRegistry.js` and `data/blog-ssr-data.json`
2. `vite build` + `client build` — Compiles frontend
3. `scripts/prerender.mjs` — Generates 80 static HTML pages + `sitemap.xml`
4. `pm2 restart 8` — Restarts server for SSR

### Adding a New Category

Edit `scripts/build-blog.mjs` and add to the `CATEGORIES` object:

```javascript
const CATEGORIES = {
  guides: { label: 'Industry Guides', description: '...' },
  news: { label: 'Network Updates', description: '...' },
  market: { label: 'Parts Market', description: '...' },
  'yard-growth': { label: 'Yard Growth', description: '...' },
  'new-category': { label: 'Display Name', description: 'Category description' },
};
```

Then create the directory: `content/blog/new-category/`

## Topic Clusters

For cluster content (hub-and-spoke architecture):

- Add `cluster`, `cluster_role`, and `cluster_group` to frontmatter
- Store cluster planning artifacts in `content/blog/{category}/_meta/` (this directory is excluded from the build since only `.md` files in the category root are scanned)
- Ensure all spoke posts link to the pillar and at least 2 other spokes
- Use descriptive anchor text for internal links, never "click here"

## Checklist

Before publishing:

- [ ] Frontmatter uses `label` (not `title`) for TOC entries
- [ ] Frontmatter uses `q`/`a` (not `question`/`answer`) for FAQ
- [ ] `coverImage` path matches an actual file in `public/images/blog/`
- [ ] All `{#id}` anchors in headings match TOC `id` values
- [ ] Images use standard markdown syntax `![alt](path)`, not `[IMAGE: ...]`
- [ ] All images optimized to WebP
- [ ] Internal links use relative paths (`/blog/category/slug`)
- [ ] External links include source attribution
- [ ] `date` is in `YYYY-MM-DD` format
- [ ] Run `npm run deploy` after changes
