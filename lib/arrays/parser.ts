import {
  type NormalizedArraysInput,
  MAX_ARRAY_LENGTH,
} from "@/lib/arrays/types";

const DEFAULT_ARRAY = [4, 2, 9, 1, 7];

export class ArraysParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArraysParserError";
  }
}

function extractArraySegment(message: string) {
  const match = message.match(/\[([^\]]+)\]/);
  return match?.[0] ?? null;
}

function parseArray(message: string) {
  const rawArray = extractArraySegment(message);

  if (!rawArray) {
    return [...DEFAULT_ARRAY];
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

export function normalizeArraysPrompt(message: string): NormalizedArraysInput {
  const trimmed = message.trim();

  if (!trimmed) {
    throw new ArraysParserError("Message is required.");
  }

  const array = parseArray(trimmed);

  return {
    array,
  };
}
