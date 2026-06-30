import {
  CertificateRequestApprovalExecutionResult,
  CertificateRequestApprovalExecutor
} from './certificate-request-approval.executor';
import { CertificateRequestApprovalLoadInput, CertificateRequestApprovalLoader } from './certificate-request-approval.loader';

export type CertificateRequestApprovalWorkflowResult = {
  status: 'not_found' | CertificateRequestApprovalExecutionResult['status'];
  message: string;
  requestId?: string;
  execution?: CertificateRequestApprovalExecutionResult;
};
export class CertificateRequestApprovalWorkflow {
  constructor(
    private readonly loader: CertificateRequestApprovalLoader,
    private readonly executor: CertificateRequestApprovalExecutor
  ) {}

  async reviewCertificateRequest(input: CertificateRequestApprovalLoadInput): Promise<CertificateRequestApprovalWorkflowResult> {
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
      requestId: execution.requestId,
      execution
    };
  }
}
