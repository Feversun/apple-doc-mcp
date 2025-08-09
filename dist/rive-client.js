import axios from 'axios';
const BASE_URL = 'https://rive.app/docs';
export class RiveDocsClient {
    cache = new Map();
    cacheTimeout = 10 * 60 * 1000; // 10 minutes
    async fetch(url) {
        const cached = this.cache.get(url);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        const response = await axios.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; RiveDocsMCP/1.0)',
                'Accept': 'text/html',
            },
        });
        this.cache.set(url, { data: response.data, timestamp: Date.now() });
        return response.data;
    }
    async getSitemap() {
        const xml = await this.fetch(`${BASE_URL}/sitemap.xml`);
        const matches = Array.from(xml.matchAll(/<loc>(.*?)<\/loc>/g));
        return matches
            .map(m => m[1])
            .filter(url => url.startsWith(BASE_URL))
            .map(url => url.replace(`${BASE_URL}/`, ''));
    }
    async getPage(path) {
        const cleanPath = path.replace(/^\/+/, '');
        const html = await this.fetch(`${BASE_URL}/${cleanPath}`);
        const titleMatch = html.match(/<title>(.*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1].replace(/\s*\|.*$/, '').trim() : cleanPath;
        const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
        const main = mainMatch ? mainMatch[1] : html;
        const content = this.extractText(main);
        return { title, content };
    }
    async search(query, maxResults = 20) {
        const paths = await this.getSitemap();
        const results = [];
        const pattern = new RegExp(query, 'i');
        for (const path of paths) {
            if (results.length >= maxResults)
                break;
            try {
                const page = await this.getPage(path);
                if (pattern.test(page.title) || pattern.test(page.content)) {
                    results.push({
                        title: page.title,
                        path,
                        snippet: this.createSnippet(page.content, query),
                    });
                }
            }
            catch {
                // ignore individual page errors
            }
        }
        return results;
    }
    extractText(html) {
        return html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\s+/g, ' ')
            .trim();
    }
    createSnippet(text, query) {
        const lower = text.toLowerCase();
        const q = query.toLowerCase();
        const idx = lower.indexOf(q);
        if (idx === -1) {
            return text.slice(0, 120) + (text.length > 120 ? '...' : '');
        }
        const start = Math.max(0, idx - 60);
        const end = Math.min(text.length, idx + q.length + 60);
        return text.slice(start, end).trim();
    }
}
//# sourceMappingURL=rive-client.js.map