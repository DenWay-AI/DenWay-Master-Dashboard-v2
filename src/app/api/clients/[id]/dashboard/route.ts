import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  try {
    const { id } = params
    const { searchParams } = new URL(request.url)

    const today = new Date()
    const defaultFrom = new Date(today)
    defaultFrom.setDate(today.getDate() - 30)

    const fromDate = searchParams.get('from') || defaultFrom.toISOString().split('T')[0]
    const toDate = searchParams.get('to') || today.toISOString().split('T')[0]

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', id)
      .single()

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const { data: metaSnaps, error: metaError } = await supabase
      .from('meta_ad_snapshots')
      .select('date, spend, leads')
      .eq('client_id', id)
      .gte('date', fromDate)
      .lte('date', toDate)

    if (metaError) throw metaError

    const { data: appointments, error: apptError } = await supabase
      .from('appointments')
      .select(
        'id, contact_name, company_name, scheduled_at, status, outcome, became_patient, consultation_outcome, treatment_value, campaign_name, ad_name'
      )
      .eq('client_id', id)
      .gte('scheduled_at', fromDate)
      .lte('scheduled_at', toDate + 'T23:59:59')
      .order('scheduled_at', { ascending: false })
      .limit(200)

    if (apptError) throw apptError

    const snapsByDate: Record<string, { spend: number; leads: number }> = {}
    for (const snap of metaSnaps || []) {
      const d = snap.date as string
      if (!snapsByDate[d]) snapsByDate[d] = { spend: 0, leads: 0 }
      snapsByDate[d].spend += Number(snap.spend) || 0
      snapsByDate[d].leads += Number(snap.leads) || 0
    }

    const chartData: { date: string; spend: number; leads: number }[] = []
    const cursor = new Date(fromDate)
    const end = new Date(toDate)
    while (cursor <= end) {
      const dateStr = cursor.toISOString().split('T')[0]
      chartData.push({
        date: dateStr,
        spend: snapsByDate[dateStr]?.spend || 0,
        leads: snapsByDate[dateStr]?.leads || 0,
      })
      cursor.setDate(cursor.getDate() + 1)
    }

    const totalSpend = chartData.reduce((s, d) => s + d.spend, 0)
    const totalLeads = chartData.reduce((s, d) => s + d.leads, 0)

    const apptList = appointments || []
    const booked = apptList.filter((a) =>
      ['booked', 'confirmed', 'completed'].includes(a.status)
    ).length
    const showed = apptList.filter((a) => a.outcome === 'showed').length
    const noShow = apptList.filter((a) => a.outcome === 'no_show').length
    const showRate = showed + noShow > 0 ? showed / (showed + noShow) : 0
    const becamePatient = apptList.filter((a) => a.became_patient).length

    const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0

    return NextResponse.json({
      kpis: {
        spend: totalSpend,
        leads: totalLeads,
        cpl,
        booked,
        showed,
        showRate,
        becamePatient,
      },
      chartData,
      appointments: apptList.map((a) => ({
        id: a.id,
        contact_name: a.contact_name,
        company_name: a.company_name,
        scheduled_at: a.scheduled_at,
        outcome: a.outcome,
        consultation_outcome: a.consultation_outcome,
        treatment_value: a.treatment_value,
        campaign_name: a.campaign_name,
        ad_name: a.ad_name,
      })),
    })
  } catch (error) {
    console.error('Error fetching client dashboard:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
