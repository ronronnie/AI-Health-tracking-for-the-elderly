import { NextRequest, NextResponse } from 'next/server';
import { getAnthropicApiKey } from '@/lib/env';
import { LAB_PARSER_SYSTEM_PROMPT } from '@/lib/services/labParserPrompt';
import type { ParsedReport, ParseUsage } from '@/lib/types';

// Claude Haiku 4.5 pricing (USD per token)
const INPUT_PRICE_PER_TOKEN = 0.80 / 1_000_000;
const OUTPUT_PRICE_PER_TOKEN = 4.0 / 1_000_000;
const USD_TO_INR = 84;

function err(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  // ── 1. Parse the uploaded file ──────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return err(400, 'Request must be multipart/form-data.');
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return err(400, 'Missing "file" field in form data.');
  }

  const mimeType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();

  // ── 2. HEIC guard ──────────────────────────────────────────────────────
  if (mimeType === 'image/heic' || mimeType === 'image/heif' ||
      fileName.endsWith('.heic') || fileName.endsWith('.heif')) {
    return err(400,
      'HEIC images are not supported. Your iPhone may have auto-converted to JPEG on upload — ' +
      "if not, switch your camera to 'Most Compatible' in Settings → Camera → Formats."
    );
  }

  // ── 3. Build the Anthropic content block ───────────────────────────────
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  type ContentBlock =
    | { type: 'text'; text: string }
    | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

  let contentBlock: ContentBlock;

  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
    // Text-based PDF path
    let extractedText: string;
    try {
      // pdf-parse v2: class-based API, accepts Uint8Array via the `data` option
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      extractedText = result.text.trim();
    } catch {
      return err(400, 'Could not read the PDF. Make sure the file is not password-protected or corrupted.');
    }
    if (extractedText.length < 200) {
      return err(400,
        'This PDF appears to be a scanned image rather than a text-based PDF. ' +
        'Scanned PDFs are not yet supported. Try uploading a photo of the report instead.'
      );
    }

    contentBlock = { type: 'text', text: extractedText };

  } else if (
    mimeType.startsWith('image/jpeg') || mimeType.startsWith('image/jpg') ||
    mimeType.startsWith('image/png') || mimeType.startsWith('image/webp') ||
    fileName.match(/\.(jpe?g|png|webp)$/)
  ) {
    // Image path — send as vision
    const validMime =
      mimeType === 'image/png' ? 'image/png'
      : mimeType === 'image/webp' ? 'image/webp'
      : 'image/jpeg';

    contentBlock = {
      type: 'image',
      source: {
        type: 'base64',
        media_type: validMime,
        data: buffer.toString('base64'),
      },
    };
  } else {
    return err(400, `Unsupported file type: "${file.type || 'unknown'}". Please upload a PDF or JPEG/PNG/WebP image.`);
  }

  // ── 4. Call Anthropic ──────────────────────────────────────────────────
  let apiKey: string;
  try {
    apiKey = getAnthropicApiKey();
  } catch (e) {
    return err(500, e instanceof Error ? e.message : 'API key not configured.');
  }

  let anthropicRes: Response;
  try {
    anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8192,
        system: LAB_PARSER_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              contentBlock,
              {
                type: 'text',
                text: 'Parse this lab report and return the JSON object as specified.',
              },
            ],
          },
        ],
      }),
    });
  } catch {
    return err(500, 'Failed to reach the Anthropic API. Check your internet connection.');
  }

  if (!anthropicRes.ok) {
    const body = await anthropicRes.text().catch(() => '');
    console.error('Anthropic API error:', anthropicRes.status, body);
    return err(502,
      `Anthropic API returned ${anthropicRes.status}. ` +
      (anthropicRes.status === 401 ? 'Check your ANTHROPIC_API_KEY.' : 'Please try again.')
    );
  }

  // ── 5. Parse the response ──────────────────────────────────────────────
  const anthropicBody = await anthropicRes.json() as {
    content: Array<{ type: string; text: string }>;
    usage: { input_tokens: number; output_tokens: number };
  };

  const rawText = anthropicBody.content?.find((b) => b.type === 'text')?.text ?? '';

  // Strip markdown code fences if present
  const jsonText = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  // Raw shape returned by the system prompt (Python-schema naming)
  type RawAiValue = {
    name: string;
    value: string;
    unit?: string | null;
    reference_range?: string | null;
    status?: 'normal' | 'low' | 'high' | 'critical';
    explanation?: string | null;
  };
  type RawAiResponse = {
    patient?: { report_date?: string | null; lab_name?: string | null; name?: string | null; age?: string | null; gender?: string | null; };
    test_panel?: string | null;
    values?: RawAiValue[];
    summary?: {
      traffic_light?: 'green' | 'yellow' | 'red';
      headline?: string;
      abnormal_count?: number;
      patterns_detected?: string[];
      next_steps?: string;
    };
    disclaimer?: string;
  };

  let parsed: ParsedReport;
  try {
    const raw = JSON.parse(jsonText) as RawAiResponse;
    parsed = {
      reportDate: raw.patient?.report_date ?? new Date().toISOString().split('T')[0],
      labName: raw.patient?.lab_name ?? undefined,
      testPanel: raw.test_panel ?? undefined,
      trafficLight: raw.summary?.traffic_light ?? 'yellow',
      headline: raw.summary?.headline ?? 'Report parsed',
      abnormalCount: raw.summary?.abnormal_count ?? 0,
      patternsDetected: raw.summary?.patterns_detected ?? [],
      nextSteps: raw.summary?.next_steps ?? '',
      disclaimer: raw.disclaimer ?? '',
      labValues: (raw.values ?? []).map((v) => ({
        name: v.name,
        value: v.value,
        unit: v.unit ?? undefined,
        referenceRange: v.reference_range ?? undefined,
        status: v.status ?? 'normal',
        explanation: v.explanation ?? undefined,
      })),
    };
  } catch {
    console.error('Failed to parse AI JSON response:', jsonText.slice(0, 500));
    return err(502, 'The AI returned an unexpected response format. Please try again.');
  }

  // ── 6. Compute cost ───────────────────────────────────────────────────
  const { input_tokens, output_tokens } = anthropicBody.usage ?? { input_tokens: 0, output_tokens: 0 };
  const costUsd = input_tokens * INPUT_PRICE_PER_TOKEN + output_tokens * OUTPUT_PRICE_PER_TOKEN;
  const usage: ParseUsage = {
    input_tokens,
    output_tokens,
    est_cost_inr: parseFloat((costUsd * USD_TO_INR).toFixed(2)),
  };

  return NextResponse.json({ parsed, usage });
}
