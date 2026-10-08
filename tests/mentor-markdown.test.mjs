import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { renderMarkdown } from '../web/markdown.js';

function render(source) {
  const dom = new JSDOM('<div></div>');
  const body = dom.window.document.querySelector('div');
  renderMarkdown(body, source);
  return body;
}

test('the reported binary formula renders its subscripts inside an ordered list', () => {
  const body = render('1. **十進位轉二進位：**\n\n   $$9_{10} = 1001_2$$\n\n   由左至右分別是各位元。');
  assert.equal(body.querySelector('ol > li strong').textContent, '十進位轉二進位：');
  assert.equal(body.querySelectorAll('.katex-display').length, 1);
  assert.equal(body.querySelectorAll('math msub').length, 2);
  assert.match(body.querySelector('math').textContent, /9\s*10\s*=\s*1001\s*2/);
});

test('headings, nested lists, quotes, tables and C fences keep their structure', () => {
  const source = '# GPIO\n\n- LED\n  - 低電位亮\n\n> 提示\n\n---\n\n| Pin | Value |\n| --- | --- |\n| PC12 | 0 |\n\n```c\nprintf("$9_2$ <script>文字</script>");\n```';
  const body = render(source);
  assert.equal(body.querySelector('h1').textContent, 'GPIO');
  assert.ok(body.querySelector('ul li ul li'));
  assert.ok(body.querySelector('blockquote p'));
  assert.ok(body.querySelector('hr'));
  assert.equal(body.querySelectorAll('.markdown-table table tbody tr').length, 1);
  assert.equal(body.querySelector('pre code').textContent.trim(), 'printf("$9_2$ <script>文字</script>");');
  assert.equal(body.querySelectorAll('.katex, script').length, 0);
});

test('all math delimiters work while inline code stays literal', () => {
  const body = render('行內 $x_1$ 與 \\(\\frac{a}{b}\\)，以及 `$x_1$`。\n\n\\[x^2\\]');
  assert.equal(body.querySelectorAll('.katex').length, 3);
  assert.equal(body.querySelector('code').textContent, '$x_1$');
  assert.equal(body.querySelectorAll('.katex-display').length, 1);
});

test('Chinese punctuation inside bold text renders without changing code literals', () => {
  const body = render('電路採用了**「低電位驅動（Active-Low）」**設計，包含**「公式 $x_1$」**。\n\n`**「原文」**`');
  assert.equal(body.querySelectorAll('strong').length, 2);
  assert.equal(body.querySelector('strong').textContent, '「低電位驅動（Active-Low）」');
  assert.ok(body.querySelector('strong .katex'));
  assert.equal(body.querySelector('code').textContent, '**「原文」**');
});

test('untrusted HTML, executable links and trusted-only math commands are rejected', () => {
  const body = render('<script>alert(1)</script><img src=x onerror=alert(1)><iframe src=about:blank></iframe>\n\n<svg onload="alert(1)"><a href="javascript:alert(1)">bad</a></svg>\n\n[bad](javascript:alert(1)) [docs](https://example.com/docs)\n\n$\\href{javascript:alert(1)}{bad}$');
  assert.equal(body.querySelectorAll('script,img,iframe,[onload],[onerror],a[href^="javascript:"]').length, 0);
  const safe = body.querySelector('a[href="https://example.com/docs"]');
  assert.equal(safe.target, '_blank');
  assert.equal(safe.rel, 'noopener noreferrer');
});

test('invalid math remains readable and does not break the next response', () => {
  const body = render('$$\\frac{$$');
  assert.ok(body.querySelector('.katex-error'));
  assert.ok(body.textContent.includes('\\frac{'));
  renderMarkdown(body, '$2^4 = 16$');
  assert.equal(body.querySelectorAll('.katex').length, 1);
  assert.equal(body.querySelectorAll('.katex-error').length, 0);
});
