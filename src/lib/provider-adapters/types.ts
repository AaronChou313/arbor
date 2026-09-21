import type {
  GenerateInput,
  ProviderConfig,
  StreamEvent,
  TestResult,
} from "../../types/domain";

export interface ProviderAdapter {
  test(config: ProviderConfig): Promise<TestResult>;
  stream(config: ProviderConfig, input: GenerateInput): AsyncGenerator<StreamEvent>;
}
