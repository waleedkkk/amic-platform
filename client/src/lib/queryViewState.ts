export type QueryViewState = "loading" | "error" | "stale" | "empty" | "data";

export function getQueryViewState({
  isLoading,
  isError,
  hasData,
  hasItems,
}: {
  isLoading: boolean;
  isError: boolean;
  hasData: boolean;
  hasItems: boolean;
}): QueryViewState {
  if (!hasData && isLoading) return "loading";
  if (!hasData && isError) return "error";
  if (hasData && isError) return "stale";
  return hasItems ? "data" : "empty";
}
