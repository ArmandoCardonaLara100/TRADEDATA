export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export type ReviewSubmission = {
  id: string;
  userId: string;
  reviewerName: string;
  reviewText: string;
  status: ReviewStatus;
  submittedAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
};

export type ReviewWorkspace = {
  reviews: ReviewSubmission[];
  isAdmin: boolean;
};
