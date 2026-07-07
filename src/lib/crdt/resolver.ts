import "server-only";
import { Operation } from "@/types";

interface ResolvedDocumentState {
  title: string;
  content: string; // Restructured plain text or rich text representation
}

/**
 * Deterministically resolves the current document state from its operations log.
 * 
 * Algorithm Proof of Determinism:
 * 1. Tombstone Deletes: Every DELETE operation specifies the exact target INSERT operation ID.
 *    These are stored in a hash set, ensuring O(1) filter performance.
 * 2. Positional Ordering: Remaining INSERT operations are sorted lexicographically by their
 *    fractional index coordinate.
 * 3. Consistent Tie-Breaking: If two concurrent operations share the exact same position,
 *    they are sorted lexicographically by their unique Lamport Timestamp ID (clientId:sequence).
 *    Since string comparison is a total order, all client nodes arrive at the exact same sequence.
 */
export function resolveDocumentState(
  operations: Operation[],
  defaultTitle: string = "Untitled Document"
): ResolvedDocumentState {
  const deletedIds = new Set<string>();
  const activeInserts: Operation[] = [];
  const titleUpdates: Operation[] = [];

  // 1. Partition operations
  for (const op of operations) {
    if (op.type === "DELETE") {
      deletedIds.add(op.value); // For deletes, 'value' holds the ID of the target INSERT
    } else if (op.type === "INSERT") {
      activeInserts.push(op);
    } else if (op.type === "UPDATE_TITLE") {
      titleUpdates.push(op);
    }
  }

  // 2. Filter out tombstoned insert operations
  const visibleInserts = activeInserts.filter((op) => !deletedIds.has(op.id));

  // 3. Sort inserts deterministically
  visibleInserts.sort((a, b) => {
    // Primary sort: Fractional Index position string
    if (a.position < b.position) return -1;
    if (a.position > b.position) return 1;

    // Secondary sort: Tie-breaker using unique Lamport IDs
    return a.id < b.id ? -1 : 1;
  });

  // 4. Resolve the document content
  const resolvedContent = visibleInserts.map((op) => op.value).join("");

  // 5. Resolve the document title (Latest Update Title wins)
  let resolvedTitle = defaultTitle;
  if (titleUpdates.length > 0) {
    titleUpdates.sort((a, b) => {
      const timeDiff = a.createdAt.getTime() - b.createdAt.getTime();
      if (timeDiff !== 0) return timeDiff;
      // In case of identical timestamps, break tie deterministically via Lamport ID
      return a.id < b.id ? -1 : 1;
    });
    resolvedTitle = titleUpdates[titleUpdates.length - 1].value;
  }

  return {
    title: resolvedTitle,
    content: resolvedContent,
  };
}
