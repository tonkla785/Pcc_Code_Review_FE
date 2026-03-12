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

<<<<<<< HEAD
        const content = MarkdownPipe.extractCleanMarkdown(value);
        const html = marked.parse(content) as string;
        return DOMPurify.sanitize(html);
    }

    static extractCleanMarkdown(raw: string): string {
        let content = raw.trim();

        if (content.startsWith('{')) {
=======
        let content = value.trim();

        // Handle case where the full JSON object is stored e.g. {\n "recommendedFixAi": "..."}
        if (content.startsWith('{')) {
            // Step 1: try JSON.parse directly
>>>>>>> main
            try {
                const parsed = JSON.parse(content);
                if (parsed.recommendedFixAi) {
                    content = parsed.recommendedFixAi;
                }
            } catch {
<<<<<<< HEAD
=======
                // Step 2: literal \n in the JSON structure makes it invalid — normalize then re-parse
>>>>>>> main
                try {
                    const normalized = content.replace(/\\n/g, '\n');
                    const parsed2 = JSON.parse(normalized);
                    if (parsed2.recommendedFixAi) {
                        content = parsed2.recommendedFixAi;
                    }
                } catch {
<<<<<<< HEAD
=======
                    // Step 3: last resort regex extraction
>>>>>>> main
                    const match = content.match(/"recommendedFixAi"\s*:\s*"([\s\S]*?)"(?:\\n|\s)*\}?\s*$/);
                    if (match && match[1]) {
                        content = match[1];
                    }
                }
            }
        }

<<<<<<< HEAD
=======
        // Unescape any remaining literal \n, \r, \t sequences
>>>>>>> main
        content = content
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"');

<<<<<<< HEAD
        return MarkdownPipe.sanitizeMarkdown(content);
    }

    private static sanitizeMarkdown(md: string): string {
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
=======
        // Parse markdown to HTML
        const html = marked.parse(content) as string;

        // Sanitize HTML to prevent XSS
        return DOMPurify.sanitize(html);
>>>>>>> main
    }
}
