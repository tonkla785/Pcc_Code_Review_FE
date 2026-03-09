import { Pipe, PipeTransform } from '@angular/core';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

@Pipe({
    name: 'markdown',
    standalone: true
})
export class MarkdownPipe implements PipeTransform {
    transform(value: string | undefined | null): string {
        if (!value) return '';

        // Parse markdown to HTML
        const html = marked.parse(value) as string;

        // Sanitize HTML to prevent XSS
        return DOMPurify.sanitize(html);
    }
}
