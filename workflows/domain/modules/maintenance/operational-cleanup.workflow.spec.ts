import { OperationalCleanupExecutionResult } from './operational-cleanup.executor';
import { OperationalCleanupLoadResult } from './operational-cleanup.loader';
import { createOperationalCleanupPlan } from './operational-cleanup-plan';
import { OperationalCleanupWorkflow } from './operational-cleanup.workflow';

const plan = createOperationalCleanupPlan(
  [
    {
      entityTable: 'email_outbox',
      entityId: 'email-job-1',
      status: 'sending',
      lockedUntil: '2026-06-27T11:30:00.000Z'
    }
  ],
  { now: '2026-06-27T12:00:00.000Z' }
);

describe('OperationalCleanupWorkflow', () => {
  it('loads a cleanup plan and delegates execution', async () => {
    const execution: OperationalCleanupExecutionResult = {
      enabled: false,
      attempted: false,
      status: 'disabled',
      message: 'Background cleanup writes are disabled. No Supabase write was attempted.',
      completedSteps: []
    };
    const loader = {
      loadPlan: jest.fn<Promise<OperationalCleanupLoadResult>, [unknown]>().mockResolvedValue({
        status: 'ready',
        plan,
        message: 'Operational cleanup plan loaded.',
        candidateCount: 1
      })
    };
    const executor = {
      execute: jest.fn<Promise<OperationalCleanupExecutionResult>, [unknown]>().mockResolvedValue(execution)
    };
    const workflow = new OperationalCleanupWorkflow(loader as never, executor as never);

    await expect(workflow.runCleanup({ now: '2026-06-27T12:00:00.000Z' })).resolves.toEqual({
      status: 'disabled',
      message: 'Background cleanup writes are disabled. No Supabase write was attempted.',
      candidateCount: 1,
      execution
    });
    expect(loader.loadPlan).toHaveBeenCalledWith({ now: '2026-06-27T12:00:00.000Z' });
    expect(executor.execute).toHaveBeenCalledWith(plan);
  });

  it('returns empty load results without calling the executor', async () => {
    const loader = {
      loadPlan: jest.fn<Promise<OperationalCleanupLoadResult>, [unknown]>().mockResolvedValue({
        status: 'empty',
        plan: createOperationalCleanupPlan([], { now: '2026-06-27T12:00:00.000Z' }),
        message: 'No operational cleanup candidates are ready.',
        candidateCount: 0
      })
    };
    const executor = {
      execute: jest.fn()
    };
    const workflow = new OperationalCleanupWorkflow(loader as never, executor as never);

    await expect(workflow.runCleanup()).resolves.toEqual({
      status: 'empty',
      message: 'No operational cleanup candidates are ready.',
      candidateCount: 0
    });
    expect(executor.execute).not.toHaveBeenCalled();
  });
});
