import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'eu-west-1' });

export async function downloadFromS3(key: string): Promise<Buffer> {
  const bucket = process.env.S3_BUCKET_NAME ?? 'spectra-uploads';
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));

  if (!response.Body) {
    throw new Error(`S3 object ${key} has no body`);
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
