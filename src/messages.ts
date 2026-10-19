import type { Match } from './search';

export type Request = { type: 'search'; query: string } | { type: 'opened' };

export interface SearchResponse {
  enabled: boolean;
  results: Match[];
}
