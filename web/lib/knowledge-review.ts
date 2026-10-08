import type { KnowledgeReview, ReviewScope } from "./knowledge-types";

/** A narrower recorded hold overrides broad approval for that operation. */
export function hasApprovedKnowledgeReview(review: KnowledgeReview, scope?: ReviewScope["kind"]): boolean {
  if (review.status !== "approved" || !review.humanReviewed) return false;
  const scoped = scope && review.scopes?.find(item => item.kind === scope);
  return !scoped || scoped.status === "approved" && scoped.humanReviewed;
}
