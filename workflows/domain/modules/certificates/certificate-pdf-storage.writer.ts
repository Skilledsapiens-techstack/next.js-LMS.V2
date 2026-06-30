import { ConfigService } from "@app/common/runtime/config";
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { CertificatePdfRenderResult } from './certificate-pdf-renderer.service';

export type CertificatePdfStorageWriteResult = {
  enabled: boolean;
  attempted: boolean;
  status: 'disabled' | 'uploaded' | 'failed';
  storageBucket: string;
  storagePath: string;
  contentType: 'application/pdf';
  pdfSha256: string;
  byteLength: number;
  message: string;
};

type SupabaseStorageUploadResult = {
  error: { message: string } | null;
};
export class CertificatePdfStorageWriter {
  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService
  ) {}

  async upload(renderResult: CertificatePdfRenderResult): Promise<CertificatePdfStorageWriteResult> {
    const baseResult = {
      storageBucket: renderResult.storageBucket,
      storagePath: renderResult.storagePath,
      contentType: renderResult.contentType,
      pdfSha256: renderResult.pdfSha256,
      byteLength: renderResult.byteLength
   };

    if (!this.config.get<boolean>('CERTIFICATE_PDF_STORAGE_WRITES_ENABLED')) {
      return {
        enabled: false,
        attempted: false,
        status: 'disabled',
        ...baseResult,
        message: 'Certificate PDF storage writes are disabled. No Supabase Storage write was attempted.'
     };
   }

    const { error } = await this.uploadPdf(renderResult);

    if (error) {
      return {
        enabled: true,
        attempted: true,
        status: 'failed',
        ...baseResult,
        message: error.message
     };
   }

    return {
      enabled: true,
      attempted: true,
      status: 'uploaded',
      ...baseResult,
      message: 'Certificate PDF uploaded to private storage.'
   };
 }

  private async uploadPdf(renderResult: CertificatePdfRenderResult): Promise<SupabaseStorageUploadResult> {
    return this.supabase.admin.storage.from(renderResult.storageBucket).upload(renderResult.storagePath, renderResult.pdfBytes, {
      contentType: renderResult.contentType,
      upsert: false
   });
 }
}
