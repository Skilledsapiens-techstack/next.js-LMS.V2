import { WorkshopMeetingProvider } from './workshop-meeting.provider';

class MockConfigService {
  constructor(private readonly values: Record<string, boolean | undefined>) {}

  get<T>(key: string): T | undefined {
    return this.values[key] as T | undefined;
  }
}

const payload = {
  title: 'Leadership Workshop',
  startsAt: '2026-06-27T15:00:00.000Z',
  durationMinutes: 90,
  timezone: 'Asia/Kolkata',
  hostEmail: 'mentor@example.com',
  agenda: 'Leadership foundations'
};

describe('WorkshopMeetingProvider', () => {
  it('does not call any provider when workshop meeting provider is disabled', async () => {
    const provider = new WorkshopMeetingProvider(new MockConfigService({ WORKSHOP_MEETING_PROVIDER_ENABLED: false }) as never);

    await expect(provider.createMeeting(payload)).resolves.toEqual({
      enabled: false,
      attempted: false,
      status: 'disabled',
      message: 'Workshop meeting provider is disabled. No provider call was attempted.'
    });
  });

  it('skips enabled meeting creation when required payload fields are invalid', async () => {
    const provider = new WorkshopMeetingProvider(new MockConfigService({ WORKSHOP_MEETING_PROVIDER_ENABLED: true }) as never);

    await expect(provider.createMeeting(undefined)).resolves.toEqual({
      enabled: true,
      attempted: false,
      status: 'skipped',
      message: 'Workshop meeting creation skipped: missing meeting payload.'
    });
    await expect(provider.createMeeting({ ...payload, title: ' ' })).resolves.toMatchObject({
      status: 'skipped',
      message: 'Workshop meeting creation skipped: missing title.'
    });
    await expect(provider.createMeeting({ ...payload, startsAt: 'not-a-date' })).resolves.toMatchObject({
      status: 'skipped',
      message: 'Workshop meeting creation skipped: invalid start time.'
    });
    await expect(provider.createMeeting({ ...payload, durationMinutes: 5 })).resolves.toMatchObject({
      status: 'skipped',
      message: 'Workshop meeting creation skipped: invalid duration.'
    });
  });

  it('fails closed when enabled but no meeting provider adapter is configured', async () => {
    const provider = new WorkshopMeetingProvider(new MockConfigService({ WORKSHOP_MEETING_PROVIDER_ENABLED: true }) as never);

    await expect(provider.createMeeting(payload)).resolves.toEqual({
      enabled: true,
      attempted: false,
      status: 'failed',
      message: 'Workshop meeting provider is enabled, but no meeting provider adapter is configured.',
      errorMessage: 'workshop_meeting_provider_adapter_missing'
    });
  });
});
