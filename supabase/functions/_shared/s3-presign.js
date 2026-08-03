import { AwsClient } from 'npm:aws4fetch@1.0.20';

// Presigns a PUT so the browser can upload straight to storage without the
// bytes passing through this function, and without ever holding a credential.
//
// The same code serves local Supabase storage and Cloudflare R2: both speak
// S3, so only endpoint, region, and credentials differ between them. That is
// deliberate — a separate implementation per environment is how a bug hides
// until deployment.
//
// `now` defaults to the real clock but can be overridden so callers (tests)
// get a deterministic signature. aws4fetch itself defaults its signing
// timestamp to `new Date()` when no `datetime` is given, which would make two
// calls issued in different seconds sign differently for identical inputs —
// exactly the scenario "the same inputs produce the same signature twice"
// needs to not happen by accident. Formatting `now` into aws4fetch's
// `datetime` option removes that dependency on wall-clock timing entirely.
export async function presignPut({
  endpoint,
  region,
  bucket,
  accessKeyId,
  secretAccessKey,
  key,
  contentType,
  expiresIn = 300,
  now = new Date(),
}) {
  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: 's3',
    region,
  });

  const url = new URL(`${endpoint.replace(/\/$/, '')}/${bucket}/${key}`);
  url.searchParams.set('X-Amz-Expires', String(expiresIn));

  const signed = await client.sign(url.toString(), {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    // signQuery puts the signature in the query string rather than an
    // Authorization header, which is what makes the result usable as a bare
    // URL the browser can PUT to directly with no credential of its own.
    //
    // Content-Type is passed to the signer, but verified directly against
    // this local stack it does NOT end up part of what gets signed:
    // aws4fetch excludes content-type from its default signable-header set
    // (its UNSIGNABLE_HEADERS list) unless `allHeaders: true` is passed, so
    // the resulting URL's X-Amz-SignedHeaders is `host` only, and a PUT sent
    // with a different Content-Type than was declared here still succeeds.
    // Do not rely on that, though — it is a property of this library's
    // defaults against this backend, not a guarantee every S3-compatible
    // target (Cloudflare R2 included) shares. Sending the same Content-Type
    // used here is still the contract: it is what the browser is asking the
    // object to be stored as, and a future backend or library change could
    // start signing it, at which point a mismatch would fail with a generic
    // SignatureDoesNotMatch that says nothing about the cause — if an
    // upload that was just signed fails opaquely, check this first.
    aws: { signQuery: true, datetime: now.toISOString().replace(/[:-]|\.\d{3}/g, '') },
  });

  return signed.url;
}
