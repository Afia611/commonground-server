/**
 * Public shape of a volunteering opportunity.
 * MongoDB documents always expose their _id as a string `id` in API responses;
 * timestamps are optional and serialized as ISO strings.
 */
export interface Opportunity {
  id: string;
  title?: string;
  description?: string;
  category?: string;
  location?: string;
  [key: string]: unknown;
}
