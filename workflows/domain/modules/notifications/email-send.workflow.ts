import {
  EmailDeliveryResultWorkflow,
  EmailDeliveryResultWorkflowResult
} from './email-delivery-result.workflow';
import {
  EmailDispatchExecutionResult,
  EmailDispatchExecutor
} from './email-dispatch.executor';
import {
  EmailDispatchLoadInput,
  EmailDispatchLoader
} from './email-dispatch.loader';
import { EmailProviderSender, EmailProviderSendResult } from './email-provider.sender';

export type EmailSendWorkflowResult = {
  status: 'not_found' | 'dispatch_blocked' | 'provider_blocked' | 'sent' | 'failed';
  message: string;
  idempotencyKey?: string;
  dispatch?: EmailDispatchExecutionResult;
  provider?: EmailProviderSendResult;
  deliveryResult?: EmailDeliveryResultWorkflowResult;
};
export class EmailSendWorkflow {
  constructor(
    private readonly loader: EmailDispatchLoader,
    private readonly dispatchExecutor: EmailDispatchExecutor,
    private readonly sender: EmailProviderSender,
    private readonly deliveryResultWorkflow: EmailDeliveryResultWorkflow
  ) {}

  async send(input: EmailDispatchLoadInput): Promise<EmailSendWorkflowResult> {
    const loadResult = await this.loader.loadPlan(input);

    if (loadResult.status !== 'ready' || !loadResult.plan) {
      return {
        status: 'not_found',
        message: loadResult.message
      };
    }

    const dispatch = await this.dispatchExecutor.execute(loadResult.plan);

    if (dispatch.status !== 'updated') {
      return {
        status: 'dispatch_blocked',
        message: dispatch.message,
        idempotencyKey: dispatch.idempotencyKey,
        dispatch
      };
    }

    const provider = await this.sender.send(loadResult.plan.dispatchPayload);

    if (provider.status === 'disabled' || provider.status === 'skipped') {
      return {
        status: 'provider_blocked',
        message: provider.message,
        idempotencyKey: dispatch.idempotencyKey,
        dispatch,
        provider
      };
    }

    const deliveryResult = await this.deliveryResultWorkflow.recordDeliveryResult({
      idempotencyKey: dispatch.idempotencyKey ?? '',
      workerId: input.workerId,
      deliveredAt: provider.deliveredAt ?? input.now,
      providerMessageId: provider.providerMessageId,
      success: provider.status === 'sent',
      errorMessage: provider.errorMessage ?? provider.message
    });

    return {
      status: provider.status === 'sent' ? 'sent' : 'failed',
      message: provider.status === 'sent' ? 'Email provider send completed.' : provider.message,
      idempotencyKey: dispatch.idempotencyKey,
      dispatch,
      provider,
      deliveryResult
    };
  }
}
