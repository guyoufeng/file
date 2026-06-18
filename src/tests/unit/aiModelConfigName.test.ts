import { describe, expect, it } from "vitest";
import { buildAiModelConfigName } from "../../services/ai/aiModelConfigName";

describe("AI model config name", () => {
  it("tracks the selected discovered model name", () => {
    expect(buildAiModelConfigName("gpustack", "qwen3.6-35b-a3b-awq")).toBe(
      "GPUStack qwen3.6-35b-a3b-awq",
    );
    expect(buildAiModelConfigName("gpustack", "qwen3-vl-embedding-8b")).toBe(
      "GPUStack qwen3-vl-embedding-8b",
    );
  });
});
