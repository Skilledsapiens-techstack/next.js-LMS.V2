import { CertificateGenerationExecutionResult, CertificateGenerationExecutor } from './certificate-generation.executor';
import { CertificateGenerationLoadInput, CertificateGenerationLoader } from './certificate-generation.loader';

export type CertificateGenerationWorkflowResult = {
  status: 'not_found' | CertificateGenerationExecutionResult['status'];
  message: string;
  certificateId?: string;
  execution?: CertificateGenerationExecutionResult;
};
export class CertificateGenerationWorkflow {
  constructor(
    private readonly loader: CertificateGenerationLoader,
    private readonly executor: CertificateGenerationExecutor
  ) {}

  async finalizeCertificate(input: CertificateGenerationLoadInput): Promise<CertificateGenerationWorkflowResult> {
    const loadResult = await this.loader.loadPlan(input);

    if (loadResult.status !== 'ready' || !loadResult.plan) {
      return {
        status: 'not_found',
        message: loadResult.message
      };
    }

    const execution = await this.executor.execute(loadResult.plan);

    return {
      status: execution.status,
      message: execution.message,
      certificateId: execution.certificateId,
      execution
    };
  }
}
