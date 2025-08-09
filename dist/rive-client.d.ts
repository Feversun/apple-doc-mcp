export interface PageData {
    title: string;
    content: string;
}
export interface SearchResult {
    title: string;
    path: string;
    snippet: string;
}
export declare class RiveDocsClient {
    private cache;
    private readonly cacheTimeout;
    private fetch;
    getSitemap(): Promise<string[]>;
    getPage(path: string): Promise<PageData>;
    search(query: string, maxResults?: number): Promise<SearchResult[]>;
    private extractText;
    private createSnippet;
}
