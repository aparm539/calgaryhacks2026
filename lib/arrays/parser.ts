import {
  type ArraysAlgorithm,
  type NormalizedArraysInput,
  MAX_ARRAY_LENGTH,
} from "@/lib/arrays/types";

const ALGORITHM_HELP =
  "Supported algorithms: linear search, binary search, quicksort, mergesort.";

export class ArraysParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArraysParserError";
  }
}

function parseAlgorithm(message: string): ArraysAlgorithm | null {
  const text = message.toLowerCase();

  if (text.includes("linear search") || text.includes("sequential search")) {
    return "linear-search";
  }

  if (text.includes("binary search")) {
    return "binary-search";
  }

  if (text.includes("quicksort") || text.includes("quick sort")) {
    return "quicksort";
  }

  if (text.includes("mergesort") || text.includes("merge sort")) {
    return "mergesort";
  }

  if (text.includes("search")) {
    return "linear-search";
  }

  if (text.includes("sort")) {
    return text.includes("merge") ? "mergesort" : "quicksort";
  }

  return null;
}

function extractArraySegment(message: string) {
  const match = message.match(/\[([^\]]+)\]/);
  return match?.[0] ?? null;
}

function parseArray(message: string) {
  const rawArray = extractArraySegment(message);

  if (!rawArray) {
    throw new ArraysParserError(
      "Please include explicit array values, e.g. [4, 2, 9, 1]."
    );
  }

  const values = rawArray
    .match(/-?\d+(?:\.\d+)?/g)
    ?.map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (!values?.length) {
    throw new ArraysParserError(
      "Array parsing failed. Provide numeric values like [4, 2, 9, 1]."
    );
  }

  if (values.length > MAX_ARRAY_LENGTH) {
    throw new ArraysParserError(
      `Array length exceeds ${MAX_ARRAY_LENGTH}. Please provide a shorter array.`
    );
  }

  return values;
}

function isSortedAscending(values: number[]) {
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] < values[i - 1]) {
      return false;
    }
  }
  return true;
}

function parseTarget(message: string, array: number[]) {
  const messageWithoutArray = message.replace(/\[[^\]]+\]/, " ");
  const patterns = [
    /(?:target|find|search\s*for|looking\s*for|key)\s*(-?\d+(?:\.\d+)?)/i,
    /(?:for)\s*(-?\d+(?:\.\d+)?)/i,
  ];

  for (const pattern of patterns) {
    const match = messageWithoutArray.match(pattern);
    if (!match) continue;

    const value = Number(match[1]);
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return array[0];
}

export function normalizeArraysPrompt(message: string): NormalizedArraysInput {
  const trimmed = message.trim();

  if (!trimmed) {
    throw new ArraysParserError("Message is required.");
  }

  const algorithm = parseAlgorithm(trimmed);
  if (!algorithm) {
    throw new ArraysParserError(
      `Could not determine algorithm. ${ALGORITHM_HELP}`
    );
  }

  const array = parseArray(trimmed);

  if (algorithm === "binary-search" && !isSortedAscending(array)) {
    throw new ArraysParserError(
      "Binary search requires a sorted array in ascending order."
    );
  }

  if (algorithm === "linear-search" || algorithm === "binary-search") {
    const target = parseTarget(trimmed, array);
    return {
      algorithm,
      array,
      target,
    };
  }

  return {
    algorithm,
    array,
  };
}
