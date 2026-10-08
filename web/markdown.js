import { Marked } from 'marked';
import createDOMPurify from 'dompurify';
import katex from 'katex';

const mathOptions = { throwOnError: false, trust: false, strict: 'ignore', maxExpand: 1000, maxSize: 12 };
const markdown = new Marked({ gfm: true, breaks: true, async: false });
const purifiers = new WeakMap();

function mathToken(src, block) {
  const patterns = block
    ? [/^ {0,3}\$\$([^]*?)\$\$[ \t]*(?:\n|$)/, /^ {0,3}\\\[([^]*?)\\\][ \t]*(?:\n|$)/]
    : [/^\$\$([^]*?)\$\$/, /^\\\[([^]*?)\\\]/, /^\\\(([^]*?)\\\)/, /^\$(?!\$)((?:\\.|[^\\$\n])+?)\$(?!\$)/];
  for (const [index, pattern] of patterns.entries()) {
    const match = pattern.exec(src);
    if (!match || !match[1].trim()) continue;
    return { type: block ? 'mathBlock' : 'mathInline', raw: match[0], text: match[1], display: block || index < 2 };
  }
}

markdown.use({ extensions: [
  {
    name: 'mentorStrong', level: 'inline',
    start: src => src.indexOf('**'),
    tokenizer(src) {
      // Chinese punctuation can touch surrounding words in mentor replies.
      const match = /^\*\*(?=\S)([^]*?\S)\*\*/.exec(src);
      if (match) return { type: 'mentorStrong', raw: match[0], tokens: this.lexer.inlineTokens(match[1]) };
    },
    renderer(token) { return '<strong>' + this.parser.parseInline(token.tokens) + '</strong>'; },
  },
  {
    name: 'mathBlock', level: 'block',
    start: src => src.match(/(?:^|\n) {0,3}(?:\$\$|\\\[)/)?.index,
    tokenizer: src => mathToken(src, true),
    renderer: token => katex.renderToString(token.text, { ...mathOptions, displayMode: true }) + '\n',
  },
  {
    name: 'mathInline', level: 'inline',
    start: src => src.match(/\$|\\[([]/)?.index,
    tokenizer: src => mathToken(src, false),
    renderer: token => katex.renderToString(token.text, { ...mathOptions, displayMode: token.display }),
  },
] });

export function renderMarkdown(container, text) {
  const document = container.ownerDocument;
  if (!purifiers.has(document)) purifiers.set(document, createDOMPurify(document.defaultView));
  const html = markdown.parse(String(text ?? ''));
  container.innerHTML = purifiers.get(document).sanitize(html, {
    USE_PROFILES: { html: true, mathMl: true, svg: true },
    FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'img', 'form', 'textarea', 'button'],
    FORBID_ATTR: ['id', 'name'],
  });
  for (const link of container.querySelectorAll('a[href]')) {
    const href = link.getAttribute('href');
    if (/^https?:\/\//i.test(href)) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    } else if (!/^(?:#|mailto:)/i.test(href)) {
      link.removeAttribute('href');
    }
  }
  for (const checkbox of container.querySelectorAll('input')) {
    if (checkbox.type === 'checkbox') checkbox.disabled = true;
    else checkbox.remove();
  }
  for (const table of container.querySelectorAll('table')) {
    const wrap = document.createElement('div');
    wrap.className = 'markdown-table';
    table.replaceWith(wrap);
    wrap.append(table);
  }
}
