import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createServerClient()
  try {
    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, status, defcon_status, created_at')
      .order('name')

    if (clientsError) throw clientsError

    const { data: appointments, error: apptError } = await supabase
      .from('appointments')
      .select('client_id, status, outcome, became_patient')
      .gte('scheduled_at', firstOfMonth)
      .lte('scheduled_at', endOfMonth)

    if (apptError) throw apptError

    const { data: metaSnaps, error: metaError } = await supabase
      .from('meta_ad_snapshots')
      .select('client_id, spend, leads')
      .gte('date', firstOfMonth.split('T')[0])
      .lte('date', endOfMonth.split('T')[0])

    const metaData = metaError ? [] : (metaSnaps || [])

    const { data: syncRun } = await supabase
      .from('sync_runs')
      .select('finished_at, status')
      .eq('status', 'success')
      .order('finished_at', { ascending: false })
      .limit(1)
      .single()

    const clientOverview = (clients || []).map((client) => {
      const clientAppts = (appointments || []).filter((a) => a.client_id === client.id)
      const booked = clientAppts.filter((a) =>
        ['booked', 'confirmed', 'completed'].includes(a.status)
      ).length
      const showed = clientAppts.filter((a) => a.outcome === 'showed').length
      const noShow = clientAppts.filter((a) => a.outcome === 'no_show').length
      const showRate = showed + noShow > 0 ? showed / (showed + noShow) : null
      const becamePatient = clientAppts.filter((a) => a.became_patient).length

      const clientMeta = metaData.filter((m) => m.client_id === client.id)
      const spend = clientMeta.reduce((s, m) => s + (Number(m.spend) || 0), 0)
      const leads = clientMeta.reduce((s, m) => s + (Number(m.leads) || 0), 0)
      const cpl = leads > 0 ? spend / leads : null
      const cps = showed > 0 && spend > 0 ? spend / showed : null
      const cpp = becamePatient > 0 && spend > 0 ? spend / becamePatient : null

      return {
        id: client.id,
        name: client.name,
        status: client.status,
        defconStatus: client.defcon_status,
        createdAt: client.created_at,
        booked,
        showed,
        noShow,
        showRate,
        becamePatient,
        spend: spend > 0 ? spend : null,
        leads: leads > 0 ? leads : null,
        cpl,
        cps,
        cpp,
        hasMeta: clientMeta.length > 0,
      }
    })

    return NextResponse.json({
      clients: clientOverview,
      lastSync: syncRun?.finished_at || null,
      period: 'this_month',
    })
  } catch (error) {
    console.error('Error fetching client overview:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
