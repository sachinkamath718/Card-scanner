import { NextRequest, NextResponse } from 'next/server';
import { extractBusinessCardData } from '@/lib/gemini';

export const dynamic = 'force-dynamic';


export async function POST(req: NextRequest) {
    try {
        const { image, mimeType } = await req.json();

        if (!image) {
            return NextResponse.json({ error: 'No image provided' }, { status: 400 });
        }

        const extracted = await extractBusinessCardData(image, mimeType || 'image/jpeg');

        return NextResponse.json({ data: extracted });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to extract card data';
        console.error('Scan API error:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
