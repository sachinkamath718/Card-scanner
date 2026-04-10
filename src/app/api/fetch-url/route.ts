import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const dynamic = 'force-dynamic';

function stripHtml(html: string): string {
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
}

export async function POST(req: NextRequest) {
    try {
        const { url } = await req.json();
        if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 });

        // Fetch the page server-side (avoids browser CORS issues)
        let pageText = '';
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
                },
                signal: AbortSignal.timeout(12000),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const html = await response.text();
            pageText = stripHtml(html).slice(0, 9000);
        } catch (fetchErr: unknown) {
            return NextResponse.json({
                error: `Could not fetch the URL: ${fetchErr instanceof Error ? fetchErr.message : 'Network error'}`,
            }, { status: 422 });
        }

        if (!pageText || pageText.length < 20) {
            return NextResponse.json({ error: 'No readable content found at that URL' }, { status: 422 });
        }

        // Use Gemini to extract contact info from the page text
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `You are extracting contact information from a webpage (likely a "Contact Us" or profile page).
Extract ALL contact details you can find. Return ONLY a valid JSON object:
{
  "first_name": "",
  "last_name": "",
  "company_name": "",
  "job_title": "",
  "email": "",
  "phone_number": "",
  "additional_emails": [],
  "additional_phones": []
}
Rules:
- "email" and "phone_number" = primary/first found.
- "additional_emails" and "additional_phones" = any other emails/phones found (can be empty []).
- If a field is not found, use "" or [].
- Do NOT include any markdown, explanation, or extra text. Return ONLY the JSON.

Webpage text:
${pageText}`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        const jsonText = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(jsonText);

        return NextResponse.json({
            data: {
                ...parsed,
                additional_emails: Array.isArray(parsed.additional_emails) ? parsed.additional_emails : [],
                additional_phones: Array.isArray(parsed.additional_phones) ? parsed.additional_phones : [],
            },
            source_url: url,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to process URL';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
