import type { ConversationNode, FinishReason, GenerationUsage, StreamEvent } from "../../types/domain";

export const MAX_AUTOMATIC_CONTINUATIONS = 5;

export const CONTINUATION_INSTRUCTION = `Continue directly from the exact point where the previous answer stopped.
Do not repeat any completed sentence, paragraph, heading, or introduction.
Do not restart the answer or repeat its title or opening.
If the answer stopped inside a Section, continue that same Section before moving on.
Keep the original language, Markdown structure, and LaTeX style.
The original user request and its requested scope remain authoritative. Complete only the unfinished portion, then stop naturally as soon as the original request is satisfied. Do not add extra material merely to fill the output budget.`;

type SegmentContext = {
  text: string;
  segmentIndex: number;
  isContinuation: boolean;
  signal: AbortSignal;
};

type SegmentEnd = {
  text: string;
  usage?: GenerationUsage;
  finishReason: FinishReason;
  providerReason?: string;
  segmentIndex: number;
  isContinuation: boolean;
};

type GenerationLoopOptions = {
  initialText?: string;
  initialUsage?: GenerationUsage;
  continueFirstSegment?: boolean;
  maxAutomaticContinuations?: number;
  signal: AbortSignal;
  streamSegment: (context: SegmentContext) => AsyncGenerator<StreamEvent>;
  onSegmentStart?: (context: Pick<SegmentContext, "segmentIndex" | "isContinuation">) => void;
  onFirstToken?: (context: Pick<SegmentContext, "segmentIndex" | "isContinuation">) => void;
  onText?: (text: string) => void;
  onUsage?: (usage: GenerationUsage) => void;
  onSegmentEnd?: (result: SegmentEnd) => void | Promise<void>;
};

export type GenerationLoopResult = {
  text: string;
  usage?: GenerationUsage;
  finishReason: FinishReason;
  providerReason?: string;
  automaticContinuations: number;
  reachedContinuationLimit: boolean;
};

export function recoverInterruptedGeneration(node: ConversationNode): ConversationNode {
  if (node.status !== "pending" && node.status !== "streaming") return node;
  return {
    ...node,
    status: "aborted",
    error: "ABORTED",
  };
}

function normalized(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function mergeContinuationText(previous: string, next: string): string {
  if (!previous) return next;
  if (!next) return previous;

  const nextCore = next.replace(/^\s+/, "");
  const maxOverlap = Math.min(previous.length, nextCore.length, 4000);
  for (let length = maxOverlap; length >= 8; length -= 1) {
    if (previous.endsWith(nextCore.slice(0, length))) {
      return previous + nextCore.slice(length);
    }
  }

  const previousLines = previous.split("\n");
  const nextLines = nextCore.split("\n");
  const maxLines = Math.min(previousLines.length, nextLines.length, 8);
  for (let count = maxLines; count >= 1; count -= 1) {
    const previousTail = previousLines.slice(-count).map(normalized);
    const nextHead = nextLines.slice(0, count).map(normalized);
    if (previousTail.every((line, index) => line && line === nextHead[index])) {
      const remainder = nextLines.slice(count).join("\n");
      if (!remainder) return previous;
      return `${previous}${previous.endsWith("\n") ? "" : "\n"}${remainder}`;
    }
  }

  const previousTrimmed = previous.trimEnd();
  const sentence = previousTrimmed.match(/(?:^|[.!?。！？]\s*)([^.!?。！？\n]{12,}[.!?。！？]?)$/u)?.[1];
  if (sentence && normalized(nextCore).startsWith(normalized(sentence))) {
    const exactIndex = nextCore.indexOf(sentence);
    if (exactIndex >= 0) return previous + nextCore.slice(exactIndex + sentence.length);
  }

  return previous + next;
}

function latestUsage(current: GenerationUsage, event: GenerationUsage): GenerationUsage {
  return {
    inputTokens: event.inputTokens ?? current.inputTokens,
    outputTokens: event.outputTokens ?? current.outputTokens,
    totalTokens: event.totalTokens ?? current.totalTokens,
  };
}

function accumulateUsage(previous: GenerationUsage | undefined, current: GenerationUsage): GenerationUsage | undefined {
  const add = (left?: number, right?: number) => right === undefined ? left : (left ?? 0) + right;
  const result = {
    inputTokens: add(previous?.inputTokens, current.inputTokens),
    outputTokens: add(previous?.outputTokens, current.outputTokens),
    totalTokens: add(previous?.totalTokens, current.totalTokens),
  };
  return Object.values(result).some((value) => value !== undefined) ? result : undefined;
}

function abortIfNeeded(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException("Generation was stopped.", "AbortError");
}

export async function runGenerationLoop(options: GenerationLoopOptions): Promise<GenerationLoopResult> {
  const maximum = options.maxAutomaticContinuations ?? MAX_AUTOMATIC_CONTINUATIONS;
  let text = options.initialText ?? "";
  let usage = options.initialUsage;
  let automaticContinuations = 0;
  let segmentIndex = 0;
  let isContinuation = options.continueFirstSegment ?? false;

  while (true) {
    abortIfNeeded(options.signal);
    options.onSegmentStart?.({ segmentIndex, isContinuation });
    const textBeforeSegment = text;
    let segmentText = "";
    let requestUsage: GenerationUsage = {};
    let finishReason: FinishReason = "unknown";
    let providerReason: string | undefined;
    let receivedToken = false;

    for await (const event of options.streamSegment({ text, segmentIndex, isContinuation, signal: options.signal })) {
      abortIfNeeded(options.signal);
      if (event.type === "text-delta") {
        if (!receivedToken) {
          receivedToken = true;
          options.onFirstToken?.({ segmentIndex, isContinuation });
        }
        segmentText += event.text;
        text = mergeContinuationText(textBeforeSegment, segmentText);
        options.onText?.(text);
      } else if (event.type === "usage") {
        requestUsage = latestUsage(requestUsage, event);
        const nextUsage = accumulateUsage(usage, requestUsage);
        if (nextUsage) options.onUsage?.(nextUsage);
      } else {
        finishReason = event.finishReason;
        providerReason = event.providerReason;
      }
    }

    abortIfNeeded(options.signal);
    text = mergeContinuationText(textBeforeSegment, segmentText);
    usage = accumulateUsage(usage, requestUsage);
    await options.onSegmentEnd?.({
      text,
      usage,
      finishReason,
      providerReason,
      segmentIndex,
      isContinuation,
    });

    if (finishReason !== "length" || automaticContinuations >= maximum) {
      return {
        text,
        usage,
        finishReason,
        providerReason,
        automaticContinuations,
        reachedContinuationLimit: finishReason === "length" && automaticContinuations >= maximum,
      };
    }

    automaticContinuations += 1;
    segmentIndex += 1;
    isContinuation = true;
  }
}
