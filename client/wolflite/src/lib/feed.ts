import type { DenSummary } from "./dens";

/**
 * A post or poll from /post/fetch or /profileInfo/fetch. Only the fields the
 * pages use directly are typed; PostCard reads the rest.
 */
export interface FeedItem {
  id: number;
  isPoll: boolean;
  author_id: number;
  created: string;
  den: DenSummary;
  [field: string]: unknown;
}
