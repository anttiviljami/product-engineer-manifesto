import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { marked } from "marked";
import matter from "gray-matter";
import ejs from "ejs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = join(scriptDir, "..");
const SITE_URL = "https://productengineer.org";

const template = ejs.compile(readFileSync(join(scriptDir, "page.ejs"), "utf8"));

// GitHub-style heading slug, so in-page anchor links (e.g. table of contents) work
const slugify = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");

marked.use({
  renderer: {
    heading({ tokens, depth, text }) {
      const inner = this.parser.parseInline(tokens);
      const cls = depth === 2 ? ' class="text-xl font-semibold"' : "";
      return `<h${depth} id="${slugify(text)}"${cls}>${inner}</h${depth}>\n`;
    },
  },
});

const renderMarkdown = (body) =>
  marked
    .parse(body)
    .replace(/<ul>/g, '<ul class="list-disc space-y-1 pl-6">')
    .replace(/<a href=/g, '<a class="text-blue-800 underline" href=');

// Pages are markdown files with a `title` in their frontmatter (README and the
// like are skipped). Each `<name>.md` is rendered to `<name>.html`, served at `/<name>`.
const collectPages = () =>
  readdirSync(root)
    .filter((file) => file.endsWith(".md"))
    .map((file) => ({ file, slug: file.replace(/\.md$/, ""), parsed: matter(readFileSync(join(root, file), "utf8")) }))
    .filter(({ parsed }) => typeof parsed.data.title === "string")
    .sort((a, b) => a.slug.localeCompare(b.slug));

const buildPage = ({ slug, parsed }) => {
  const { title, heading } = parsed.data;
  const html = template({
    title,
    heading: heading ?? title,
    content: renderMarkdown(parsed.content),
  });
  writeFileSync(join(root, `${slug}.html`), html);
  return slug;
};

const buildSitemap = (pages) => {
  const locs = [
    SITE_URL,
    `${SITE_URL}/product-engineer-checklist.pdf`,
    ...pages.map(({ slug }) => `${SITE_URL}/${slug}`),
    ...pages.map(({ slug }) => `${SITE_URL}/${slug}.md`),
  ];
  const urls = locs.map((loc) => `  <url>\n    <loc>${loc}</loc>\n  </url>`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  writeFileSync(join(root, "sitemap.xml"), xml);
};

const pages = collectPages();
pages.forEach(buildPage);
buildSitemap(pages);

console.log(`Built ${pages.length} pages: ${pages.map((p) => p.slug).join(", ")}`);
console.log("Wrote sitemap.xml");
