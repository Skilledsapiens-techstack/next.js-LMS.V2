import { EnrollmentActivationExecutionResult } from './enrollment-activation.executor';
import { EnrollmentActivationLoadResult } from './enrollment-activation.loader';
import { createEnrollmentActivationPlan } from './enrollment-activation-plan';
import { EnrollmentActivationWorkflow } from './enrollment-activation.workflow';

class MockLoader {
  input?: unknown;
  result: EnrollmentActivationLoadResult = {
    status: 'ready',
    message: 'Enrollment activation plan loaded.',
    plan: createEnrollmentActivationPlan(
      { status: 'paid', orderId: 'order_123', paymentId: 'pay_123' },
      {
        requestId: 'enr_123',
        email: 'student@example.com',
        paymentStatus: 'cohort_assigned'
      },
      [
        {
          itemId: 'item_1',
          itemType: 'program',
          itemName: 'MBA',
          programKey: 'mba',
          status: 'cohort_assigned'
        }
      ]
    )
  };

  loadPlan(input: unknown) {
    this.input = input;
    return Promise.resolve(this.result);
  }
}

class MockExecutor {
  plan?: unknown;
  result: EnrollmentActivationExecutionResult = {
    enabled: false,
    attempted: false,
    status: 'disabled',
    requestId: 'enr_123',
    message: 'Enrollment activation is disabled. No Supabase write was attempted.',
    completedSteps: []
  };

  execute(plan: unknown) {
    this.plan = plan;
    return Promise.resolve(this.result);
  }
}

describe('EnrollmentActivationWorkflow', () => {
  it('loads a plan and delegates execution without choosing the trigger', async () => {
    const loader = new MockLoader();
    const executor = new MockExecutor();
    const workflow = new EnrollmentActivationWorkflow(loader as never, executor as never);

    await expect(workflow.activateFromPayment({ orderId: 'order_123', paymentId: 'pay_123' })).resolves.toEqual({
      status: 'disabled',
      message: 'Enrollment activation is disabled. No Supabase write was attempted.',
      requestId: 'enr_123',
      execution: executor.result
    });
    expect(loader.input).toEqual({ orderId: 'order_123', paymentId: 'pay_123' });
    expect(executor.plan).toBe(loader.result.plan);
  });

  it('does not call the executor when source loading returns not found', async () => {
    const loader = new MockLoader();
    loader.result = {
      status: 'not_found',
      message: 'No enrollment request matched the paid payment order.'
    };
    const executor = new MockExecutor();
    const workflow = new EnrollmentActivationWorkflow(loader as never, executor as never);

    await expect(workflow.activateFromPayment({ orderId: 'order_123' })).resolves.toEqual({
      status: 'not_found',
      message: 'No enrollment request matched the paid payment order.'
    });
    expect(executor.plan).toBeUndefined();
  });

  it('returns activation failures from the executor unchanged', async () => {
    const loader = new MockLoader();
    const executor = new MockExecutor();
    executor.result = {
      enabled: true,
      attempted: true,
      status: 'failed',
      requestId: 'enr_123',
      message: 'paid access write failed',
      completedSteps: ['students'],
      failedStep: 'paid_access'
    };
    const workflow = new EnrollmentActivationWorkflow(loader as never, executor as never);

    await expect(workflow.activateFromPayment({ paymentId: 'pay_123' })).resolves.toEqual({
      status: 'failed',
      message: 'paid access write failed',
      requestId: 'enr_123',
      execution: executor.result
    });
  });
});
