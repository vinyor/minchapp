import { Pipe, PipeTransform } from '@angular/core';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true,
});

/**
 * Renders recipe markdown safely.
 * Thermomix params like [8 min / 100°C / vel 2] become highlighted spans.
 */
@Pipe({
  name: 'recipeMarkdown',
  pure: true,
})
export class RecipeMarkdownPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value?.trim()) return '';

    const withParams = value.replace(
      /\[([^\]\n]+)\]/g,
      (_match, inner: string) =>
        `<span class="tm-param" data-tm-param>${escapeHtml(inner.trim())}</span>`,
    );

    const html = marked.parse(withParams, { async: false }) as string;
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ['data-tm-param'],
    });
  }
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
