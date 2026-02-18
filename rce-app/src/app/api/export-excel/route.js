import { NextResponse } from 'next/server';
const { populateBiddingTemplate } = require('@/lib/excel');

export async function POST(request) {
    try {
        const { items } = await request.json();

        if (!items || !Array.isArray(items)) {
            return NextResponse.json({ error: 'Itens inválidos' }, { status: 400 });
        }

        // We don't save to a local path anymore as per user request for browser download
        const buffer = await populateBiddingTemplate(items);

        return new Response(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename="Orcamento_RCE.xlsx"'
            }
        });
    } catch (error) {
        console.error('Excel Export Error:', error);
        return NextResponse.json({
            error: error.message || 'Erro ao gerar Excel'
        }, { status: 500 });
    }
}
