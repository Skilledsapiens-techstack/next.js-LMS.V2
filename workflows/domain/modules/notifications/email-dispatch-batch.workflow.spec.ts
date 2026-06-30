import { EmailDispatchBatchLoadResult } from './email-dispatch-batch.loader';
import { EmailSendWorkflowResult } from './email-send.workflow';
import { EmailDispatchBatchWorkflow } from './email-dispatch-batch.workflow';

class MockBatchLoader {
  result: EmailDispatchBatchLoadResult = {
    status: 'ready',
    idempotencyKeys: ['email-ready-1', 'email-ready-2'],
    message: 'Email dispatch batch loaded.'
  };
  input?: unknown;

  loadPendingBatch(input: unknown) {
    this.input = input;
    return Promise.resolve(this.result);
  }
}

class MockEmailSendWorkflow {
  calls: unknown[] = [];
  result: EmailSendWorkflowResult = {
    status: 'provider_blocked',
    message: 'Email provider sends are disabled. No provider call was attempted.',
    idempotencyKey: 'email-ready-1'
  };

  send(input: unknown) {
    this.calls.push(input);
    return Promise.resolve({
      ...this.result,
      idempotencyKey: typeof input === 'object' && input && 'idempotencyKey' in input ? String(input.idempotencyKey) : undefined
    });
  }
}

describe('EmailDispatchBatchWorkflow', () => {
  it('requires a worker ID before loading a dispatch batch', async () => {
    const loader = new MockBatchLoader();
    const sender = new MockEmailSendWorkflow();
    const workflow = new EmailDispatchBatchWorkflow(loader as never, sender as never);

    await expect(workflow.processBatch({ workerId: ' ' })).resolves.toEqual({
      status: 'empty',
      message: 'Email dispatch batch skipped: worker ID is required.',
      requestedCount: 0,
      processedCount: 0,
      results: []
    });
    expect(loader.input).toBeUndefined();
    expect(sender.calls).toEqual([]);
  });

  it('returns empty loader results without calling the send workflow', async () => {
    const loader = new MockBatchLoader();
    loader.result = {
      status: 'empty',
      idempotencyKeys: [],
      message: 'No email dispatch jobs are ready.'
    };
    const sender = new MockEmailSendWorkflow();
    const workflow = new EmailDispatchBatchWorkflow(loader as never, sender as never);

    await expect(workflow.processBatch({ workerId: 'email-worker-1', now: '2026-06-27T10:00:00.000Z' })).resolves.toEqual({
      status: 'empty',
      message: 'No email dispatch jobs are ready.',
      requestedCount: 0,
      processedCount: 0,
      results: []
    });
    expect(sender.calls).toEqual([]);
  });

  it('processes each loaded dispatch key sequentially through the email send workflow', async () => {
    const loader = new MockBatchLoader();
    const sender = new MockEmailSendWorkflow();
    const workflow = new EmailDispatchBatchWorkflow(loader as never, sender as never);

    await expect(
      workflow.processBatch({
        workerId: ' email-worker-1 ',
        now: '2026-06-27T10:00:00.000Z',
        limit: 10,
        maxAttempts: 3
      })
    ).resolves.toEqual({
      status: 'processed',
      message: 'Email dispatch batch processed.',
      requestedCount: 2,
      processedCount: 2,
      results: [
        {
          idempotencyKey: 'email-ready-1',
          result: {
            status: 'provider_blocked',
            message: 'Email provider sends are disabled. No provider call was attempted.',
            idempotencyKey: 'email-ready-1'
          }
        },
        {
          idempotencyKey: 'email-ready-2',
          result: {
            status: 'provider_blocked',
            message: 'Email provider sends are disabled. No provider call was attempted.',
            idempotencyKey: 'email-ready-2'
          }
        }
      ]
    });
    expect(loader.input).toEqual({
      workerId: ' email-worker-1 ',
      now: '2026-06-27T10:00:00.000Z',
      limit: 10,
      maxAttempts: 3
    });
    expect(sender.calls).toEqual([
      {
        idempotencyKey: 'email-ready-1',
        workerId: 'email-worker-1',
        now: '2026-06-27T10:00:00.000Z',
        maxAttempts: 3
      },
      {
        idempotencyKey: 'email-ready-2',
        workerId: 'email-worker-1',
        now: '2026-06-27T10:00:00.000Z',
        maxAttempts: 3
      }
    ]);
  });
});
