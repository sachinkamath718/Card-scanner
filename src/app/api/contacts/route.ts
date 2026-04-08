import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';


// GET /api/contacts?event_id=xxx
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('event_id');

    if (!eventId) {
        return NextResponse.json({ error: 'event_id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('event_id', eventId)
        .order('scanned_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
}

// POST /api/contacts
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { event_id, first_name, last_name, company_name, job_title, email, phone_number, raw_image_url } = body;

        if (!event_id) {
            return NextResponse.json({ error: 'event_id is required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('contacts')
            .insert([{ event_id, first_name, last_name, company_name, job_title, email, phone_number, raw_image_url }])
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to save contact';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
