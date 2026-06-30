import { CertificateRequestApprovalExecutionResult } from './certificate-request-approval.executor';
import { CertificateRequestApprovalLoadResult } from './certificate-request-approval.loader';
import { createCertificateRequestApprovalPlan } from './certificate-request-approval-plan';
import { CertificateRequestApprovalWorkflow } from './certificate-request-approval.workflow';

class MockLoader {
  input?: unknown;
  result: CertificateRequestApprovalLoadResult = {
    status: 'ready',
    message: 'Certificate request approval plan loaded.',
    plan: createCertificateRequestApprovalPlan(
      {
        requestId: 'certificate_request:student@example.com:lp-123',
        requestType: 'live_project',
        studentEmail: 'student@example.com',
        studentName: 'Student Name',
        projectId: 'lp-123',
        projectTitle: 'Market Research Project',
        projectRole: 'Research Analyst',
        programKey: 'mba',
        cohortName: 'MBA 2026',
        moderatorStatus: 'approved',
        adminStatus: 'pending'
      },
      {
        decision: 'approve',
        adminEmail: 'admin@example.com',
        certificateId: 'SS-LP-2026-0001',
        decidedAt: '2026-06-27T10:00:00.000Z'
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
  result: CertificateRequestApprovalExecutionResult = {
    enabled: false,
    attempted: false,
    status: 'disabled',
    requestId: 'certificate_request:student@example.com:lp-123',
    message: 'Certificate request approval writes are disabled. No Supabase write was attempted.',
    completedSteps: []
  };

  execute(plan: unknown) {
    this.plan = plan;
    return Promise.resolve(this.result);
  }
}

describe('CertificateRequestApprovalWorkflow', () => {
  it('loads a plan and delegates execution without choosing the trigger', async () => {
    const loader = new MockLoader();
    const executor = new MockExecutor();
    const workflow = new CertificateRequestApprovalWorkflow(loader as never, executor as never);
    const input = {
      requestId: 'certificate_request:student@example.com:lp-123',
      decision: 'approve' as const,
      adminEmail: 'admin@example.com',
      certificateId: 'SS-LP-2026-0001'
    };

    await expect(workflow.reviewCertificateRequest(input)).resolves.toEqual({
      status: 'disabled',
      message: 'Certificate request approval writes are disabled. No Supabase write was attempted.',
      requestId: 'certificate_request:student@example.com:lp-123',
      execution: executor.result
    });
    expect(loader.input).toEqual(input);
    expect(executor.plan).toBe(loader.result.plan);
  });

  it('does not call the executor when source loading returns not found', async () => {
    const loader = new MockLoader();
    loader.result = {
      status: 'not_found',
      message: 'No certificate request matched the approval source identity.'
    };
    const executor = new MockExecutor();
    const workflow = new CertificateRequestApprovalWorkflow(loader as never, executor as never);

    await expect(
      workflow.reviewCertificateRequest({
        requestId: 'missing-request',
        decision: 'approve',
        adminEmail: 'admin@example.com'
      })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'No certificate request matched the approval source identity.'
    });
    expect(executor.plan).toBeUndefined();
  });

  it('returns certificate request approval failures from the executor unchanged', async () => {
    const loader = new MockLoader();
    const executor = new MockExecutor();
    executor.result = {
      enabled: true,
      attempted: true,
      status: 'failed',
      requestId: 'certificate_request:student@example.com:lp-123',
      message: 'generation job write failed',
      completedSteps: ['certificate_requests'],
      failedStep: 'certificate_generation_jobs'
    };
    const workflow = new CertificateRequestApprovalWorkflow(loader as never, executor as never);

    await expect(
      workflow.reviewCertificateRequest({
        requestId: 'certificate_request:student@example.com:lp-123',
        decision: 'approve',
        adminEmail: 'admin@example.com'
      })
    ).resolves.toEqual({
      status: 'failed',
      message: 'generation job write failed',
      requestId: 'certificate_request:student@example.com:lp-123',
      execution: executor.result
    });
  });
});
