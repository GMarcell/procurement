export type SearchParams = Record<string, string | string[] | undefined>;

/** Search params can be repeated; pages only need the first value. */
export function param(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}
