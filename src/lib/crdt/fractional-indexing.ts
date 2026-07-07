/**
 * Generates a string that is lexicographically between two other strings.
 * Used to assign stable, sorted coordinates to elements in a collaborative list (LSEQ CRDT).
 * 
 * ASCII ranges used: Space (32) to Tilde (126).
 */
export function generatePositionBetween(left: string, right: string): string {
  // Boundary constraints
  const minChar = 32;  // ASCII Space (lowest printable ASCII coordinate)
  const maxChar = 126; // ASCII Tilde (highest printable ASCII coordinate)

  // Guard: if left is greater than or equal to right, fail gracefully to prevent lockouts
  if (left !== "" && right !== "" && left >= right) {
    return left + String.fromCharCode(Math.floor((minChar + maxChar) / 2));
  }

  const leftCodes = left.split("").map((c) => c.charCodeAt(0));
  const rightCodes = right.split("").map((c) => c.charCodeAt(0));

  const resultCodes: number[] = [];
  let i = 0;

  while (true) {
    const leftVal = i < leftCodes.length ? leftCodes[i] : minChar;
    // If we run out of right characters, use maxChar + 1 as boundary
    const rightVal = i < rightCodes.length ? rightCodes[i] : maxChar + 1;

    // Check if there is room between the character codes
    if (rightVal - leftVal > 1) {
      const midVal = Math.floor((leftVal + rightVal) / 2);
      resultCodes.push(midVal);
      break;
    } else {
      // If consecutive, copy the left char and shift right to the next character depth
      resultCodes.push(leftVal);
      i++;
    }
  }

  return String.fromCharCode(...resultCodes);
}
