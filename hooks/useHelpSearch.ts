import { useMemo } from "react";
import {
  buildHelpIndex,
  searchHelp,
  HelpSearchResult,
  SearchableGroup,
} from "@/utils/helpSearch";

export function useHelpSearch(
  groups: SearchableGroup[],
  query: string,
): HelpSearchResult {
  const index = useMemo(() => buildHelpIndex(groups), [groups]);
  return useMemo(() => searchHelp(index, query), [index, query]);
}
