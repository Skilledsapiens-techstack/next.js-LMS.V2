import { CertificatePdfRenderResult } from './certificate-pdf-renderer.service';
import { CertificatePdfStorageWriter } from './certificate-pdf-storage.writer';

class MockConfigService {
  constructor(private readonly values: Record<string, boolean | undefined>) {}

  get<T>(key: string): T | undefined {
    return this.values[key] as T | undefined;
  }
}

class MockStorageBucket {
  uploads: Array<{ path: string; bytes: Buffer; options: unknown }> = [];

  constructor(private readonly result: { data: unknown; error: { message: string } | null }) {}

  upload(path: string, bytes: Buffer, options: unknown) {
    this.uploads.push({ path, bytes, options });
    return Promise.resolve(this.result);
  }
}

class MockStorage {
  buckets = new Map<string, MockStorageBucket>();
  selectedBuckets: string[] = [];

  constructor(private readonly result: { data: unknown; error: { message: string } | null } = { data: {}, error: null }) {}

  from(bucket: string) {
    this.selectedBuckets.push(bucket);
    const storageBucket = new MockStorageBucket(this.result);
    this.buckets.set(bucket, storageBucket);
    return storageBucket;
  }
}

class MockSupabaseAdmin {
  storage: MockStorage;

  constructor(storage: MockStorage) {
    this.storage = storage;
  }
}

class MockSupabase {
  admin: MockSupabaseAdmin;

  constructor(storage = new MockStorage()) {
    this.admin = new MockSupabaseAdmin(storage);
  }
}

const renderResult: CertificatePdfRenderResult = {
  contentType: 'application/pdf',
  storageBucket: 'certificates-private',
  storagePath: 'live-project/SS-LP-2026-0001.pdf',
  pdfBytes: Buffer.from('%PDF-1.4\n%%EOF\n', 'utf8'),
  pdfSha256: 'a'.repeat(64),
  byteLength: 15
};

describe('CertificatePdfStorageWriter', () => {
  it('does not call Supabase Storage when certificate PDF storage writes are disabled', async () => {
    const supabase = new MockSupabase();
    const writer = new CertificatePdfStorageWriter(new MockConfigService({ CERTIFICATE_PDF_STORAGE_WRITES_ENABLED: false }) as never, supabase as never);

    await expect(writer.upload(renderResult)).resolves.toEqual({
      enabled: false,
      attempted: false,
      status: 'disabled',
      storageBucket: 'certificates-private',
      storagePath: 'live-project/SS-LP-2026-0001.pdf',
      contentType: 'application/pdf',
      pdfSha256: 'a'.repeat(64),
      byteLength: 15,
      message: 'Certificate PDF storage writes are disabled. No Supabase Storage write was attempted.'
    });
    expect(supabase.admin.storage.selectedBuckets).toEqual([]);
  });

  it('uploads the PDF to the planned private storage target when enabled', async () => {
    const supabase = new MockSupabase();
    const writer = new CertificatePdfStorageWriter(new MockConfigService({ CERTIFICATE_PDF_STORAGE_WRITES_ENABLED: true }) as never, supabase as never);

    await expect(writer.upload(renderResult)).resolves.toMatchObject({
      enabled: true,
      attempted: true,
      status: 'uploaded',
      storageBucket: 'certificates-private',
      storagePath: 'live-project/SS-LP-2026-0001.pdf',
      message: 'Certificate PDF uploaded to private storage.'
    });
    expect(supabase.admin.storage.selectedBuckets).toEqual(['certificates-private']);
    expect(supabase.admin.storage.buckets.get('certificates-private')?.uploads).toEqual([
      {
        path: 'live-project/SS-LP-2026-0001.pdf',
        bytes: renderResult.pdfBytes,
        options: {
          contentType: 'application/pdf',
          upsert: false
        }
      }
    ]);
  });

  it('reports Supabase Storage upload failures with the planned target metadata', async () => {
    const storage = new MockStorage({ data: null, error: { message: 'storage upload failed' } });
    const supabase = new MockSupabase(storage);
    const writer = new CertificatePdfStorageWriter(new MockConfigService({ CERTIFICATE_PDF_STORAGE_WRITES_ENABLED: true }) as never, supabase as never);

    await expect(writer.upload(renderResult)).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'failed',
      storageBucket: 'certificates-private',
      storagePath: 'live-project/SS-LP-2026-0001.pdf',
      contentType: 'application/pdf',
      pdfSha256: 'a'.repeat(64),
      byteLength: 15,
      message: 'storage upload failed'
    });
  });
});
