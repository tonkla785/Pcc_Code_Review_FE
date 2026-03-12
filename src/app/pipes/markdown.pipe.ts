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

        let content = value.trim();

        if (content.startsWith('{')) {
            try {
                const parsed = JSON.parse(content);
                if (parsed.recommendedFixAi) {
                    content = parsed.recommendedFixAi;
                }
            } catch {
                try {
                    const normalized = content.replace(/\\n/g, '\n');
                    const parsed2 = JSON.parse(normalized);
                    if (parsed2.recommendedFixAi) {
                        content = parsed2.recommendedFixAi;
                    }
                } catch {
                    const match = content.match(/"recommendedFixAi"\s*:\s*"([\s\S]*?)"(?:\\n|\s)*\}?\s*$/);
                    if (match && match[1]) {
                        content = match[1];
                    }
                }
            }
        }

        content = content
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"');

        content = this.sanitizeMarkdown(content);

        const html = marked.parse(content) as string;

        return DOMPurify.sanitize(html);
    }

    private sanitizeMarkdown(md: string): string {
        let s = md;

        s = s.replace(/"```/g, '\n```');
        s = s.replace(/```"/g, '```\n');

        s = s.replace(/([^\n])```(\w*)/g, '$1\n```$2');

        s = s.replace(/([^\n])```(\s*\n|$)/g, '$1\n```$2');

        s = s.replace(/([^\n#])(#{1,5}\s)/g, '$1\n$2');

        s = s.replace(/```\s*```/g, '```');

        s = s.replace(/^\s*\{\s*"recommendedFixAi"\s*:\s*"?/i, '');
        s = s.replace(/"?\s*\}\s*$/, '');

         s = s.replace(/\n{3,}/g, '\n\n');

        return s.trim();
    }
}
