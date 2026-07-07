export interface DiffToken {
  type: "added" | "removed" | "equal";
  value: string;
}

/**
 * Computes the word-level differences between two strings using the Longest Common Subsequence (LCS) algorithm.
 * Groups adjacent diff tokens for clean visual rendering.
 */
export function computeWordDiff(original: string, modified: string): DiffToken[] {
  // Split strings by word boundaries and spaces, preserving spacing in the token array
  const originalWords = original.split(/(\s+)/);
  const modifiedWords = modified.split(/(\s+)/);

  const dp: number[][] = Array(originalWords.length + 1)
    .fill(null)
    .map(() => Array(modifiedWords.length + 1).fill(0));

  // 1. Calculate LCS Matrix
  for (let i = 1; i <= originalWords.length; i++) {
    for (let j = 1; j <= modifiedWords.length; j++) {
      if (originalWords[i - 1] === modifiedWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: DiffToken[] = [];
  let i = originalWords.length;
  let j = modifiedWords.length;

  // 2. Backtrack through matrix to find added, removed, and equal segments
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && originalWords[i - 1] === modifiedWords[j - 1]) {
      result.unshift({ type: "equal", value: originalWords[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: "added", value: modifiedWords[j - 1] });
      j--;
    } else {
      result.unshift({ type: "removed", value: originalWords[i - 1] });
      i--;
    }
  }

  // 3. Consolidate adjacent tokens of the same type to keep the array length minimal
  const consolidated: DiffToken[] = [];
  for (const token of result) {
    const last = consolidated[consolidated.length - 1];
    if (last && last.type === token.type) {
      last.value += token.value;
    } else {
      consolidated.push(token);
    }
  }

  return consolidated;
}
