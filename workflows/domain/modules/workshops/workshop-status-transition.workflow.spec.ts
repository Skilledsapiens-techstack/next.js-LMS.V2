import { WorkshopStatusTransitionExecutionResult } from './workshop-status-transition.executor';
import { WorkshopStatusTransitionLoadResult } from './workshop-status-transition.loader';
import { createWorkshopStatusTransitionPlan } from './workshop-status-transition-plan';
import { WorkshopStatusTransitionWorkflow } from './workshop-status-transition.workflow';

class MockLoader {
  input?: unknown;
  result: WorkshopStatusTransitionLoadResult = {
    status: 'ready',
    message: 'Workshop status transition plan loaded.',
    plan: createWorkshopStatusTransitionPlan(
      {
        id: 'workshop-row-uuid',
        workshopId: 'WS-001',
        title: 'Live Consulting Session',
        status: 'Scheduled'
      },
      {
        adminEmail: 'admin@example.com',
        nextStatus: 'Live',
        changedAt: '2026-06-27T10:00:00.000Z'
      }
    )
  };

  loadPlan(input: unknown) {
    this.input = input;
    return Promise.resolve(this.result);
  }
}

class MockExecutor {
  plan?: unknown;
  result: WorkshopStatusTransitionExecutionResult = {
    enabled: false,
    attempted: false,
    status: 'disabled',
    workshopId: 'workshop-row-uuid',
    message: 'Workshop status writes are disabled. No Supabase write was attempted.',
    completedSteps: []
  };

  execute(plan: unknown) {
    this.plan = plan;
    return Promise.resolve(this.result);
  }
}

describe('WorkshopStatusTransitionWorkflow', () => {
  it('loads a plan and delegates execution without choosing the trigger', async () => {
    const loader = new MockLoader();
    const executor = new MockExecutor();
    const workflow = new WorkshopStatusTransitionWorkflow(loader as never, executor as never);
    const input = {
      workshopId: 'workshop-row-uuid',
      nextStatus: 'Live' as const,
      adminEmail: 'admin@example.com'
    };

    await expect(workflow.transitionStatus(input)).resolves.toEqual({
      status: 'disabled',
      message: 'Workshop status writes are disabled. No Supabase write was attempted.',
      workshopId: 'workshop-row-uuid',
      execution: executor.result
    });
    expect(loader.input).toEqual(input);
    expect(executor.plan).toBe(loader.result.plan);
  });

  it('does not call the executor when source loading returns not found', async () => {
    const loader = new MockLoader();
    loader.result = {
      status: 'not_found',
      message: 'No workshop matched the status transition source identity.'
    };
    const executor = new MockExecutor();
    const workflow = new WorkshopStatusTransitionWorkflow(loader as never, executor as never);

    await expect(
      workflow.transitionStatus({
        workshopId: 'missing-workshop',
        nextStatus: 'Live',
        adminEmail: 'admin@example.com'
      })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'No workshop matched the status transition source identity.'
    });
    expect(executor.plan).toBeUndefined();
  });

  it('returns workshop status failures from the executor unchanged', async () => {
    const loader = new MockLoader();
    const executor = new MockExecutor();
    executor.result = {
      enabled: true,
      attempted: true,
      status: 'failed',
      workshopId: 'workshop-row-uuid',
      message: 'workshop status update failed',
      completedSteps: [],
      failedStep: 'workshops'
    };
    const workflow = new WorkshopStatusTransitionWorkflow(loader as never, executor as never);

    await expect(
      workflow.transitionStatus({
        workshopId: 'workshop-row-uuid',
        nextStatus: 'Live',
        adminEmail: 'admin@example.com'
      })
    ).resolves.toEqual({
      status: 'failed',
      message: 'workshop status update failed',
      workshopId: 'workshop-row-uuid',
      execution: executor.result
    });
  });
});
