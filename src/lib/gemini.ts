import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface ExtractedContact {
    first_name: string;
    last_name: string;
    company_name: string;
    job_title: string;
    email: string;
    phone_number: string;
    additional_emails: string[];
    additional_phones: string[];
}

export async function extractBusinessCardData(
    base64Image: string,
    mimeType: string,
    backBase64?: string,
    backMimeType?: string,
): Promise<ExtractedContact> {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const hasBothSides = !!backBase64;

    const prompt = hasBothSides
        ? `You are an expert at reading business cards.
You are given TWO images: the FRONT and BACK of the same business card.
Combine the information from BOTH sides. Extract ALL phone numbers and ALL email addresses found.
Return ONLY a valid JSON object with these exact keys:
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
- "email" and "phone_number" should be the primary/first ones found.
- "additional_emails" and "additional_phones" are arrays of any remaining ones (can be empty arrays []).
- If any field is not found, use empty string or empty array.
Do NOT include any explanation, markdown, or extra text. Return ONLY the JSON object.`
        : `You are an expert at reading business cards.
Extract ALL contact information from this business card image. Capture ALL phone numbers and ALL email addresses.
Return ONLY a valid JSON object with these exact keys:
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
- "email" and "phone_number" should be the primary/first ones found.
- "additional_emails" and "additional_phones" are arrays of any remaining ones (can be empty arrays []).
- If any field is not found, use empty string or empty array.
Do NOT include any explanation, markdown, or extra text. Return ONLY the JSON object.`;

    const parts: Parameters<typeof model.generateContent>[0] = [
        prompt,
        { inlineData: { mimeType, data: base64Image } },
    ];

    if (hasBothSides && backBase64) {
        parts.push({ inlineData: { mimeType: backMimeType || 'image/jpeg', data: backBase64 } });
    }

    const result = await model.generateContent(parts);
    const text = result.response.text().trim();
    const jsonText = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(jsonText);

    // Ensure arrays exist even if model omits them
    return {
        ...parsed,
        additional_emails: Array.isArray(parsed.additional_emails) ? parsed.additional_emails : [],
        additional_phones: Array.isArray(parsed.additional_phones) ? parsed.additional_phones : [],
    } as ExtractedContact;
}
