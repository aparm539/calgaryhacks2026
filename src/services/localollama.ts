// src/services/localollama.ts
// Local Ollama chat API wrapper for Dependence/Independence scoring.
// Designed for VSCode extensions running on Node 18+ (global fetch available).

export type AnalysisDimensionScores = {
  structural_similarity: number; // 0-20
  understanding_signals: number; // 0-20
  verification_robustness: number; // 0-15
  style_cohesion: number; // 0-10
  risk_indicators: number; // 0-10
  testing_edge_cases: number; // 0-15
  security_failure_modes: number; // 0-10
};

export type KeyEvidenceItem = {
  dimension: string;
  severity: 1 | 2 | 3 | 4 | 5;
  location: string;
  explanation: string;
};

export type AnalysisResult = {
  dependence_score: number;
  independence_score: number;
  confidence: number;
  dimension_scores?: Partial<AnalysisDimensionScores>;
  key_evidence?: KeyEvidenceItem[]; 
  refactoring_depth?: "low" | "moderate" | "high";
  ai_edit_pattern?: "minimal_edit" | "partial_restructure" | "major_rewrite";
  recommended_reflection_tasks?: string[];
  questions_to_check_understanding?: string[];
  short_summary?: string;

  // If parsing fails or Ollama errors, we return a soft-failure object:
  error?: string;
  raw_output?: string;
};

export type AnalyzeDependenceInput = {
  taskDescription: string;
  techStack: string;
  constraints?: string;
  aiDraftCode?: string;
  finalCode: string;
  diffText?: string;
  userExplanation?: string;

  // Optional overrides
  model?: string;
  baseUrl?: string; // default http://localhost:11434
  timeoutMs?: number; // default 30000

  // Safety controls for small local models
  maxCharsPerSection?: number; // default 12000
};

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_MODEL = "granite4:micro";

const SYSTEM_PROMPT = `
You are a strict but fair Code Independence Auditor.

Your goal is NOT to detect cheating.
Your goal is to estimate how dependent the final code appears to be on AI-generated output,
and whether the developer demonstrates independent understanding, reasoning, and verification.

Return ONLY valid JSON.
No markdown.
No explanation outside JSON.
No trailing commas.

Scoring philosophy:
- DependenceScore (0-100): Higher = more AI reliance risk.
- IndependenceScore (0-100): Higher = more independent thinking.
- IndependenceScore does NOT have to be exactly 100 - DependenceScore.
- Be evidence-based. If unsure, lower confidence.

Evaluation dimensions:
1) Structural Similarity (superficial vs structural changes)
2) Logical Understanding Signals
3) Verification & Robustness
4) Code Cohesion & Style Consistency
5) Risk Indicators (unused code, magic numbers, unreachable branches, overengineering)
6) Testing & Edge Case Handling
7) Security & Failure Mode Awareness (if applicable)

Output format EXACTLY:

{
  "dependence_score": number,
  "independence_score": number,
  "confidence": number (0-1),
  "dimension_scores": {
    "structural_similarity": number (0-20),
    "understanding_signals": number (0-20),
    "verification_robustness": number (0-15),
    "style_cohesion": number (0-10),
    "risk_indicators": number (0-10),
    "testing_edge_cases": number (0-15),
    "security_failure_modes": number (0-10)
  },
  "key_evidence": [
    {
      "dimension": "string",
      "severity": 1-5,
      "location": "file:line-range or description",
      "explanation": "concise explanation"
    }
  ],
  "refactoring_depth": "low | moderate | high",
  "ai_edit_pattern": "minimal_edit | partial_restructure | major_rewrite",
  "recommended_reflection_tasks": [
    "task 1",
    "task 2",
    "task 3"
  ],
  "questions_to_check_understanding": [
    "question 1",
    "question 2",
    "question 3"
  ],
  "short_summary": "2-4 sentence explanation"
}
`;

const USER_PROMPT_TEMPLATE = `
Evaluate AI dependence for the following coding task.

Task Description:
{{TASK_DESCRIPTION}}

Tech Stack:
{{TECH_STACK}}

Constraints:
{{CONSTRAINTS}}

--------------------------------------------------
AI Draft Code:
{{AI_DRAFT_CODE}}

--------------------------------------------------
Final Code Submitted:
{{FINAL_CODE}}

--------------------------------------------------
Git Diff (if available):
{{DIFF_TEXT}}

--------------------------------------------------
User Self Explanation (if provided):
{{USER_EXPLANATION}}

--------------------------------------------------

Evaluation Instructions:

- Identify whether changes are superficial (renaming, formatting) or structural (algorithm redesign, abstraction change).
- Detect signs of understanding: explanation of complexity, reasoning for design choices, edge-case awareness.
- Identify missing robustness: error handling, input validation, failure cases.
- Detect suspicious patterns: unused imports, generic comments, boilerplate not adapted, magic constants.
- Detect cohesion issues: abrupt style shifts, inconsistent naming, mismatched abstraction levels.
- Detect whether testing or verification logic exists.
- Detect whether security concerns were considered (if applicable).

Be strict but fair.
If evidence is insufficient, lower confidence.
Return JSON only.
`;

function truncateSection(label: string, text: string, maxChars: number): string {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars)}\n\n[TRUNCATED ${label} to ${maxChars} chars]`;
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v);
  }
  return out;
}

function extractJsonObject(raw: string): string {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return a JSON object.");
  }
  return raw.slice(start, end + 1);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function sanitizeResult(obj: any): AnalysisResult {
  // Minimal sanity checks to avoid weird outputs breaking the UI.
  const dependence = clamp(Number(obj?.dependence_score ?? 0), 0, 100);
  const independence = clamp(Number(obj?.independence_score ?? 0), 0, 100);
  const confidence = clamp(Number(obj?.confidence ?? 0), 0, 1);

  return {
    ...obj,
    dependence_score: dependence,
    independence_score: independence,
    confidence,
  } as AnalysisResult;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    const errorName = (err as { name?: string })?.name;
    if (errorName === "AbortError") {
      const body = JSON.stringify({
        error: "Request timed out before Ollama responded.",
        timeoutMs,
        url,
      });
      return new Response(body, {
        status: 504,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Analyze AI dependence using a local Ollama model.
 *
 * Returns a structured AnalysisResult. On failure, returns { error, raw_output? }.
 */
export async function analyzeDependence(input: AnalyzeDependenceInput): Promise<AnalysisResult> {
  const baseUrl = input.baseUrl ?? DEFAULT_BASE_URL;
  const model = input.model ?? DEFAULT_MODEL;
  const timeoutMs = input.timeoutMs ?? 30_000;
  const maxChars = input.maxCharsPerSection ?? 12_000;

  const vars: Record<string, string> = {
    TASK_DESCRIPTION: truncateSection("TASK_DESCRIPTION", input.taskDescription || "[MISSING TASK DESCRIPTION]", maxChars),
    TECH_STACK: truncateSection("TECH_STACK", input.techStack || "[MISSING TECH STACK]", maxChars),
    CONSTRAINTS: truncateSection("CONSTRAINTS", input.constraints || "[NONE]", maxChars),
    AI_DRAFT_CODE: truncateSection("AI_DRAFT_CODE", input.aiDraftCode || "[MISSING AI DRAFT]", maxChars),
    FINAL_CODE: truncateSection("FINAL_CODE", input.finalCode || "[MISSING FINAL CODE]", maxChars),
    DIFF_TEXT: truncateSection("DIFF_TEXT", input.diffText || "[NO DIFF AVAILABLE]", maxChars),
    USER_EXPLANATION: truncateSection("USER_EXPLANATION", input.userExplanation || "[NONE]", maxChars),
  };

  const userPrompt = fillTemplate(USER_PROMPT_TEMPLATE, vars);

  const payload = {
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    stream: false,
  };

  const url = `${baseUrl.replace(/\/$/, "")}/api/chat`;

  let responseText = "";
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      timeoutMs
    );

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return {
        dependence_score: 0,
        independence_score: 0,
        confidence: 0,
        error: `Ollama HTTP ${res.status} ${res.statusText}${errBody ? `: ${errBody}` : ""}`,
      };
    }

    const data: any = await res.json();
    responseText = String(data?.message?.content ?? "");

    if (!responseText.trim()) {
      return {
        dependence_score: 0,
        independence_score: 0,
        confidence: 0,
        error: "Empty model response.",
      };
    }

    const jsonStr = extractJsonObject(responseText);
    const parsed = JSON.parse(jsonStr);
    return sanitizeResult(parsed);
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? `Request timed out after ${timeoutMs}ms` : String(e?.message ?? e);
    return {
      dependence_score: 0,
      independence_score: 0,
      confidence: 0,
      error: msg,
      raw_output: responseText || undefined,
    };
  }
}
