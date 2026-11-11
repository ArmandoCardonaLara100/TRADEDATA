export type NewsCategory='latest'|'stocks'|'forex'|'crypto';

export interface MarketNewsArticle {
 id:string;title:string;description:string;publishedAt:string;source:string;
 author:string|null;imageUrl:string|null;articleUrl:string;tickers:string[];category:NewsCategory;
}

export interface MarketNewsResponse {
 articles:MarketNewsArticle[];category:NewsCategory;availableCategories:NewsCategory[];
 status:'ok'|'stale';checkedAt:string;fetchedAt:string;page:number;hasMore:boolean;
}
