import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/contacts?event_id=xxx
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('event_id');
    if (!eventId) return NextResponse.json({ error: 'event_id is required' }, { status: 400 });

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
        const {
            event_id, first_name, last_name, company_name, job_title,
            email, phone_number, raw_image_url, back_image_url,
            discussion_details, additional_emails, additional_phones,
        } = body;

        if (!event_id) return NextResponse.json({ error: 'event_id is required' }, { status: 400 });

        const { data, error } = await supabase
            .from('contacts')
            .insert([{
                event_id, first_name, last_name, company_name, job_title,
                email, phone_number,
                raw_image_url: raw_image_url || null,
                back_image_url: back_image_url || null,
                discussion_details: discussion_details || null,
                additional_emails: additional_emails || null,
                additional_phones: additional_phones || null,
            }])
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to save contact';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// POST /api/contacts?bulk=1  — body: { event_id, rows: Contact[] }
export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { event_id, rows } = body as { event_id: string; rows: Record<string, string>[] };

        if (!event_id) return NextResponse.json({ error: 'event_id is required' }, { status: 400 });
        if (!Array.isArray(rows) || rows.length === 0)
            return NextResponse.json({ error: 'rows array is required' }, { status: 400 });

        const records = rows.map(r => ({
            event_id,
            first_name: r.first_name || null,
            last_name: r.last_name || null,
            company_name: r.company_name || null,
            job_title: r.job_title || null,
            email: r.email || null,
            phone_number: r.phone_number || null,
            additional_emails: r.additional_emails || null,
            additional_phones: r.additional_phones || null,
            discussion_details: r.discussion_details || null,
            raw_image_url: null,
            back_image_url: null,
        }));

        const { data, error } = await supabase.from('contacts').insert(records).select();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ data, inserted: data?.length ?? 0 });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Bulk insert failed';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// PATCH /api/contacts?id=xxx  { discussion_details: string }
export async function PATCH(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    try {
        const body = await req.json();
        const { discussion_details } = body;

        const { data, error } = await supabase
            .from('contacts')
            .update({ discussion_details: discussion_details ?? null })
            .eq('id', id)
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to update contact';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// DELETE /api/contacts?id=xxx
export async function DELETE(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
