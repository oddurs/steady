import { error } from '@sveltejs/kit';
import { Marked, Renderer } from 'marked';
import { docs } from '../../../lib/generated/docs';
import type { PageServerLoad } from './$types';

export function entries() {
  return docs.map(({ slug }) => ({ slug }));
}

const escape = (text: string) => text.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

export const load: PageServerLoad = ({ params }) => {
  const index = docs.findIndex((entry) => entry.slug === params.slug);
  const entry = docs[index];
  if (!entry) error(404, 'This documentation page does not exist.');
  const toc: { id: string; title: string }[] = [];
  const ids = new Map<string, number>();
  const marked = new Marked({
    renderer: {
      heading({ tokens, depth }) {
        const content = this.parser.parseInline(tokens);
        const title = content.replace(/<[^>]*>/g, '');
        const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const count = ids.get(base) ?? 0;
        ids.set(base, count + 1);
        const id = count ? `${base}-${count}` : base;
        if (depth <= 3) toc.push({ id, title });
        return `<h${depth} id="${id}"><a href="#${id}">${content}</a></h${depth}>`;
      },
      code({ text, lang }) {
        return `<div class="doc-code"><span class="code-language">${escape(lang || 'code')}</span><pre><code>${escape(text)}</code></pre></div>`;
      },
      table(token) { return `<div class="table-scroll" tabindex="0" role="region" aria-label="Reference table">${Renderer.prototype.table.call(this, token)}</div>`; },
    },
  });
  const body = entry.body.replace(/^# [^\n]+\n/, '').replace(/\]\((api|performance|integrations|design|svelte|getting-started)\.md([^)]*)\)/g, (_, file, hash) => `](/docs/${file === 'api' ? 'tasks' : file}/${hash})`);
  const html = marked.parse(body, { async: false });
  const metadata = ({ body: _body, ...page }: typeof entry) => page;
  return { ...metadata(entry), html, toc, previous: index ? metadata(docs[index - 1]) : null, next: docs[index + 1] ? metadata(docs[index + 1]) : null };
};
