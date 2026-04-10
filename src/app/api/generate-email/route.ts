import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// POST /api/generate-email  body: { contact_id: string }
export async function POST(req: NextRequest) {
    try {
        const { contact_id } = await req.json();
        if (!contact_id) {
            return NextResponse.json({ error: 'contact_id is required' }, { status: 400 });
        }

        // Fetch the full contact record from Supabase
        const { data: contact, error } = await supabase
            .from('contacts')
            .select('*')
            .eq('id', contact_id)
            .single();

        if (error || !contact) {
            return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
        }

        const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'there';
        const company = contact.company_name || '';
        const role = contact.job_title || '';
        const email = contact.email || '';
        const discussion = contact.discussion_details || '';

        const prompt = `You are a professional business development executive drafting a warm follow-up email after meeting someone at a networking event.

Contact Details:
- Name: ${fullName}
- Company: ${company}
- Role: ${role}
- Email: ${email}
${discussion ? `- Discussion Notes: ${discussion}` : ''}

Write a concise, warm, and professional follow-up email. 
${discussion ? 'Reference the discussion notes naturally in the body.' : 'Keep it general but personalized.'}

Return ONLY a valid JSON object with exactly these two keys:
{
  "subject": "...",
  "body": "..."
}

The body should be plain text with line breaks using \\n. Do NOT include markdown, HTML, or any extra text outside the JSON.`;

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();

        // Strip markdown code fences
        const jsonText = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(jsonText) as { subject: string; body: string };

        return NextResponse.json({ subject: parsed.subject, body: parsed.body });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to generate email';
        console.error('Generate email error:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
