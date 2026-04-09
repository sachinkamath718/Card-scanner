import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface ExtractedContact {
    first_name: string;
    last_name: string;
    company_name: string;
    job_title: string;
    email: string;
    phone_number: string;
}

export async function extractBusinessCardData(base64Image: string, mimeType: string): Promise<ExtractedContact> {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are an expert at reading business cards. 
Extract the following information from this business card image and return ONLY a valid JSON object with these exact keys:
{
  "first_name": "",
  "last_name": "",
  "company_name": "",
  "job_title": "",
  "email": "",
  "phone_number": ""
}
If any field is not found on the card, leave the value as an empty string. 
Do NOT include any explanation, markdown, or extra text. Return ONLY the JSON object.`;

    const result = await model.generateContent([
        prompt,
        {
            inlineData: {
                mimeType: mimeType,
                data: base64Image,
            },
        },
    ]);

    const text = result.response.text().trim();

    // Strip markdown code fences if present
    const jsonText = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();

    const parsed = JSON.parse(jsonText);
    return parsed as ExtractedContact;
}
