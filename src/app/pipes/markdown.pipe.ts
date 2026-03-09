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

        // Handle case where the full JSON object is stored e.g. {\n "recommendedFixAi": "..."}
        if (content.startsWith('{')) {
            // Step 1: try JSON.parse directly
            try {
                const parsed = JSON.parse(content);
                if (parsed.recommendedFixAi) {
                    content = parsed.recommendedFixAi;
                }
            } catch {
                // Step 2: literal \n in the JSON structure makes it invalid — normalize then re-parse
                try {
                    const normalized = content.replace(/\\n/g, '\n');
                    const parsed2 = JSON.parse(normalized);
                    if (parsed2.recommendedFixAi) {
                        content = parsed2.recommendedFixAi;
                    }
                } catch {
                    // Step 3: last resort regex extraction
                    const match = content.match(/"recommendedFixAi"\s*:\s*"([\s\S]*?)"(?:\\n|\s)*\}?\s*$/);
                    if (match && match[1]) {
                        content = match[1];
                    }
                }
            }
        }

        // Unescape any remaining literal \n, \r, \t sequences
        content = content
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"');

        // Parse markdown to HTML
        const html = marked.parse(content) as string;

        // Sanitize HTML to prevent XSS
        return DOMPurify.sanitize(html);
    }
}
