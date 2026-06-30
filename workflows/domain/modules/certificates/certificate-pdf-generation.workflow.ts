import { CertificateGenerationWorkflow, CertificateGenerationWorkflowResult } from './certificate-generation.workflow';
import { CertificatePdfRenderExecutionResult, CertificatePdfRenderExecutor } from './certificate-pdf-render.executor';
import { CertificatePdfRenderLoadInput, CertificatePdfRenderLoader } from './certificate-pdf-render.loader';
import { CertificatePdfRenderResult, CertificatePdfRendererService } from './certificate-pdf-renderer.service';
import { CertificatePdfStorageWriteResult, CertificatePdfStorageWriter } from './certificate-pdf-storage.writer';

export type CertificatePdfGenerationWorkflowInput = CertificatePdfRenderLoadInput & {
  generatedAt?: string;
  publicVerificationUrl?: string;
};

export type CertificatePdfGenerationWorkflowResult = {
  status: 'not_found' | 'skipped' | 'render_start_failed' | 'render_failed' | 'storage_disabled' | 'storage_failed' | CertificateGenerationWorkflowResult['status'];
  message: string;
  renderStart?: CertificatePdfRenderExecutionResult;
  renderResult?: Omit<CertificatePdfRenderResult, 'pdfBytes'>;
  storage?: CertificatePdfStorageWriteResult;
  finalization?: CertificateGenerationWorkflowResult;
};
export class CertificatePdfGenerationWorkflow {
  constructor(
    private readonly renderLoader: CertificatePdfRenderLoader,
    private readonly renderStartExecutor: CertificatePdfRenderExecutor,
    private readonly renderer: CertificatePdfRendererService,
    private readonly storageWriter: CertificatePdfStorageWriter,
    private readonly finalizationWorkflow: CertificateGenerationWorkflow
  ) {}

  async generateCertificatePdf(input: CertificatePdfGenerationWorkflowInput): Promise<CertificatePdfGenerationWorkflowResult> {
    const loadResult = await this.renderLoader.loadPlan(input);

    if (loadResult.status !== 'ready' || !loadResult.plan) {
      return {
        status: 'not_found',
        message: loadResult.message
      };
    }

    if (!loadResult.plan.shouldRender) {
      return {
        status: 'skipped',
        message: `Certificate PDF generation skipped: ${loadResult.plan.reason}.`
      };
    }

    const renderStart = await this.renderStartExecutor.execute(loadResult.plan);

    if (renderStart.status === 'failed') {
      return {
        status: 'render_start_failed',
        message: renderStart.message,
        renderStart
      };
    }

    let renderResult: CertificatePdfRenderResult;

    try {
      renderResult = this.renderer.render(loadResult.plan);
    } catch (error) {
      return {
        status: 'render_failed',
        message: error instanceof Error ? error.message : 'Certificate PDF rendering failed.',
        renderStart
      };
    }

    const storage = await this.storageWriter.upload(renderResult);
    const renderResultSummary = this.summarizeRenderResult(renderResult);

    if (storage.status === 'disabled') {
      return {
        status: 'storage_disabled',
        message: storage.message,
        renderStart,
        renderResult: renderResultSummary,
        storage
      };
    }

    if (storage.status === 'failed') {
      return {
        status: 'storage_failed',
        message: storage.message,
        renderStart,
        renderResult: renderResultSummary,
        storage
      };
    }

    const finalization = await this.finalizationWorkflow.finalizeCertificate({
      jobIdempotencyKey: input.jobIdempotencyKey,
      workerId: input.workerId,
      generatedAt: input.generatedAt,
      issueDate: input.issueDate,
      storageBucket: renderResult.storageBucket,
      storagePath: renderResult.storagePath,
      pdfSha256: renderResult.pdfSha256,
      publicVerificationUrl: input.publicVerificationUrl ?? loadResult.plan.renderDocument?.verificationUrl
    });

    return {
      status: finalization.status,
      message: finalization.message,
      renderStart,
      renderResult: renderResultSummary,
      storage,
      finalization
    };
  }

  private summarizeRenderResult(renderResult: CertificatePdfRenderResult): Omit<CertificatePdfRenderResult, 'pdfBytes'> {
    return {
      contentType: renderResult.contentType,
      storageBucket: renderResult.storageBucket,
      storagePath: renderResult.storagePath,
      pdfSha256: renderResult.pdfSha256,
      byteLength: renderResult.byteLength
    };
  }
}
