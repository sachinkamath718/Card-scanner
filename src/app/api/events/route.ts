import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';


// GET /api/events
export async function GET() {
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
}

// POST /api/events
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, date, location } = body;

        if (!name) {
            return NextResponse.json({ error: 'Event name is required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('events')
            .insert([{ name, date: date || null, location: location || null }])
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to create event';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
