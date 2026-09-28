/**
 * URL of a workspace logo served by the authenticated /api/logo route.
 * `v` changes whenever the logo changes so browsers refetch it.
 */
export function logoSrcFor(org: { slug: string; logoKey: string | null; logoUpdatedAt: Date | null }): string | null {
  if (!org.logoKey) return null;
  const v = org.logoUpdatedAt ? org.logoUpdatedAt.getTime() : 0;
  return `/api/logo/${encodeURIComponent(org.slug)}?v=${v}`;
}
