export type AdminRange='7d'|'30d'|'90d'|'all';
export type AdminReviewStatus='all'|'pending'|'approved'|'rejected';

export type AdminKpis={
 totalUsers:number;activeUsers:number;newUsers:number;tradingAccounts:number;
 dailyActiveUsers:number;weeklyActiveUsers:number;monthlyActiveUsers:number;
 trades:number;tradesToday:number;tradesThisWeek:number;tradesThisMonth:number;pendingReviews:number;
};

export type AdminGrowthPoint={date:string;newUsers:number;activeUsers:number};
export type AdminFeatureUsage={
 feature:string;total_events:number;page_views:number;actual_uses:number;
 distinct_users:number;adoption_percent:number;trend_percent:number|null;
};
export type AdminFeatureTimelinePoint={date:string;feature:string;actualUses:number};
export type AdminUser={
 name:string;createdAt:string;role:'user'|'review_admin'|'admin';lastActivity:string|null;
 accountCount:number;tradeCount:number;status:'active'|'inactive'|'blocked';
};
export type AdminReview={
 id:string;reviewerName:string;reviewText:string;status:'pending'|'approved'|'rejected';
 submittedAt:string;approvedAt:string|null;isOwn:boolean;
};
export type AdminPage<T>={page:number;pageSize:number;total:number;items:T[]};
export type AdminDashboardData={
 range:AdminRange;generatedAt:string;analyticsEnabledAt:string|null;kpis:AdminKpis;userGrowth:AdminGrowthPoint[];
 featureTimeline:AdminFeatureTimelinePoint[];features:AdminFeatureUsage[];users:AdminPage<AdminUser>;
 reviews:AdminPage<AdminReview>&{status:AdminReviewStatus};
};
