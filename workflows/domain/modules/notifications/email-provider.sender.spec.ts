import { EmailProviderSender } from './email-provider.sender';

class MockConfigService {
  constructor(private readonly values: Record<string, boolean | undefined>) {}

  get<T>(key: string): T | undefined {
    return this.values[key] as T | undefined;
  }
}

const payload = {
  to: 'student@example.com',
  subject: 'Ticket SUP-123 created',
  html: '<p>Hello Student</p>',
  text: 'Hello Student'
};

describe('EmailProviderSender', () => {
  it('does not call any provider when provider sends are disabled', async () => {
    const sender = new EmailProviderSender(new MockConfigService({ EMAIL_PROVIDER_SENDS_ENABLED: false }) as never);

    await expect(sender.send(payload)).resolves.toEqual({
      enabled: false,
      attempted: false,
      status: 'disabled',
      message: 'Email provider sends are disabled. No provider call was attempted.'
    });
  });

  it('skips enabled sends when the dispatch payload is incomplete', async () => {
    const sender = new EmailProviderSender(new MockConfigService({ EMAIL_PROVIDER_SENDS_ENABLED: true }) as never);

    await expect(sender.send(undefined)).resolves.toEqual({
      enabled: true,
      attempted: false,
      status: 'skipped',
      message: 'Email provider send skipped: missing dispatch payload.'
    });
    await expect(sender.send({ ...payload, to: ' ' })).resolves.toMatchObject({
      status: 'skipped',
      message: 'Email provider send skipped: missing recipient.'
    });
    await expect(sender.send({ ...payload, subject: ' ' })).resolves.toMatchObject({
      status: 'skipped',
      message: 'Email provider send skipped: missing subject.'
    });
    await expect(sender.send({ ...payload, html: ' ' })).resolves.toMatchObject({
      status: 'skipped',
      message: 'Email provider send skipped: missing HTML body.'
    });
  });

  it('fails closed when sends are enabled but no adapter is configured', async () => {
    const sender = new EmailProviderSender(new MockConfigService({ EMAIL_PROVIDER_SENDS_ENABLED: true }) as never);

    await expect(sender.send(payload)).resolves.toEqual({
      enabled: true,
      attempted: false,
      status: 'failed',
      message: 'Email provider sends are enabled, but no email provider adapter is configured.',
      errorMessage: 'email_provider_adapter_missing'
    });
  });
});
