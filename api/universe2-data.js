import { neon } from '@neondatabase/serverless';

const number = (value) => Number(value ?? 0);
const round = (value, digits = 2) => Number(number(value).toFixed(digits));

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Database connection is not configured' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const [pnlRows, marketingRows, channelRows, receiptRows, serviceRows, payrollRows] = await Promise.all([
      sql`SELECT month_start, recognized_revenue, operating_expenses, operating_profit, operating_margin_pct
          FROM public.demo_monthly_pnl
          WHERE company_name = 'Northstar Growth'
          ORDER BY month_start`,
      sql`SELECT p.month_start,
                SUM(m.spend)::numeric AS spend,
                SUM(m.impressions)::bigint AS impressions,
                SUM(m.clicks)::bigint AS clicks,
                SUM(m.leads)::bigint AS leads,
                SUM(m.qualified_leads)::bigint AS qualified_leads,
                SUM(m.opportunities)::bigint AS opportunities,
                SUM(m.deals_won)::bigint AS deals_won,
                SUM(m.attributed_revenue)::numeric AS attributed_revenue
          FROM public.demo_marketing_metrics m
          JOIN public.demo_companies c ON c.id = m.company_id
          JOIN public.demo_periods p ON p.id = m.period_id
          WHERE c.slug = 'northstar-growth'
          GROUP BY p.month_start
          ORDER BY p.month_start`,
      sql`SELECT month_start, channel, spend, impressions, clicks, leads, qualified_leads,
                opportunities, deals_won, attributed_revenue, cost_per_lead,
                cost_per_qualified_lead, ctr_pct, lead_conversion_pct, attributed_roas
          FROM public.demo_marketing_dashboard
          WHERE company_name = 'Northstar Growth'
          ORDER BY month_start, channel`,
      sql`SELECT p.month_start, SUM(t.amount)::numeric AS receipts
          FROM public.demo_transactions t
          JOIN public.demo_companies c ON c.id = t.company_id
          JOIN public.demo_periods p ON p.id = t.period_id
          WHERE c.slug = 'northstar-growth'
            AND t.direction = 'income'
            AND t.cash_status = 'received'
          GROUP BY p.month_start
          ORDER BY p.month_start`,
      sql`SELECT name, delivery_cost_pct
          FROM public.demo_service_lines
          WHERE company_id = (SELECT id FROM public.demo_companies WHERE slug = 'northstar-growth' LIMIT 1)
          ORDER BY name`,
      sql`SELECT SUM(monthly_gross_cost)::numeric AS monthly_payroll, COUNT(*)::int AS team_size
          FROM public.demo_employees
          WHERE company_id = (SELECT id FROM public.demo_companies WHERE slug = 'northstar-growth' LIMIT 1)`
    ]);

    if (!pnlRows.length) {
      return res.status(404).json({ error: 'Northstar Growth demo data was not found in Neon' });
    }

    const marketingByMonth = new Map(marketingRows.map(row => [String(row.month_start).slice(0, 10), row]));
    const receiptsByMonth = new Map(receiptRows.map(row => [String(row.month_start).slice(0, 10), row]));
    const months = pnlRows.map(row => {
      const key = String(row.month_start).slice(0, 10);
      const m = marketingByMonth.get(key) ?? {};
      const receipt = receiptsByMonth.get(key) ?? {};
      const spend = number(m.spend);
      const qualifiedLeads = number(m.qualified_leads);
      return {
        month_start: key,
        recognized_revenue: number(row.recognized_revenue),
        operating_expenses: number(row.operating_expenses),
        operating_profit: number(row.operating_profit),
        operating_margin_pct: number(row.operating_margin_pct),
        marketing_spend: spend,
        impressions: number(m.impressions),
        clicks: number(m.clicks),
        leads: number(m.leads),
        qualified_leads: qualifiedLeads,
        opportunities: number(m.opportunities),
        deals_won: number(m.deals_won),
        attributed_revenue: number(m.attributed_revenue),
        cost_per_qualified_lead: qualifiedLeads ? round(spend / qualifiedLeads) : 0,
        receipts: number(receipt.receipts)
      };
    });

    const channels = channelRows.map(row => ({
      month_start: String(row.month_start).slice(0, 10),
      channel: row.channel,
      spend: number(row.spend),
      impressions: number(row.impressions),
      clicks: number(row.clicks),
      leads: number(row.leads),
      qualified_leads: number(row.qualified_leads),
      opportunities: number(row.opportunities),
      deals_won: number(row.deals_won),
      attributed_revenue: number(row.attributed_revenue),
      cost_per_lead: number(row.cost_per_lead),
      cost_per_qualified_lead: number(row.cost_per_qualified_lead),
      ctr_pct: number(row.ctr_pct),
      lead_conversion_pct: number(row.lead_conversion_pct),
      attributed_roas: number(row.attributed_roas)
    }));

    return res.status(200).json({
      company: 'Northstar Growth',
      currency: 'EUR',
      source: 'Neon PostgreSQL',
      fetched_at: new Date().toISOString(),
      months,
      channels,
      service_lines: serviceRows.map(row => ({ name: row.name, delivery_cost_pct: number(row.delivery_cost_pct) })),
      team: { monthly_payroll: number(payrollRows[0]?.monthly_payroll), size: number(payrollRows[0]?.team_size) }
    });
  } catch (error) {
    console.error('Universe 2 Neon data request failed:', error);
    return res.status(500).json({ error: 'Could not load demo data from Neon' });
  }
}
