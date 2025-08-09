import axios from 'axios';

const BASE_URL = 'https://rive.app/docs';

export interface PageData {
  title: string;
  content: string;
}

export interface SearchResult {
  title: string;
  path: string;
  snippet: string;
}

export class RiveDocsClient {
  private cache = new Map<string, { data: string; timestamp: number }>();
  private readonly cacheTimeout = 10 * 60 * 1000; // 10 minutes

  private async fetch(url: string): Promise<string> {
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

  async getSitemap(): Promise<string[]> {
    const xml = await this.fetch(`${BASE_URL}/sitemap.xml`);
    const matches = Array.from(xml.matchAll(/<loc>(.*?)<\/loc>/g));
    return matches
      .map(m => m[1])
      .filter(url => url.startsWith(BASE_URL))
      .map(url => url.replace(`${BASE_URL}/`, ''));
  }

  async getPage(path: string): Promise<PageData> {
    const cleanPath = path.replace(/^\/+/, '');
    const html = await this.fetch(`${BASE_URL}/${cleanPath}`);

    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s*\|.*$/, '').trim() : cleanPath;

    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const main = mainMatch ? mainMatch[1] : html;
    const content = this.extractText(main);

    return { title, content };
  }

  async search(query: string, maxResults = 20): Promise<SearchResult[]> {
    const paths = await this.getSitemap();
    const results: SearchResult[] = [];
    const pattern = new RegExp(query, 'i');

    for (const path of paths) {
      if (results.length >= maxResults) break;
      try {
        const page = await this.getPage(path);
        if (pattern.test(page.title) || pattern.test(page.content)) {
          results.push({
            title: page.title,
            path,
            snippet: this.createSnippet(page.content, query),
          });
        }
      } catch {
        // ignore individual page errors
      }
    }

    return results;
  }

  private extractText(html: string): string {
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

  private createSnippet(text: string, query: string): string {
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
