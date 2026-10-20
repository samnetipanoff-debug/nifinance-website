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
    const [pnlRows, marketingRows, channelRows, receiptRows, serviceRows, payrollRows, dealRows, transactionRows, employeeRows] = await Promise.all([
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
          WHERE company_id = (SELECT id FROM public.demo_companies WHERE slug = 'northstar-growth' LIMIT 1)`,
      sql`SELECT p.month_start, d.client_name, d.deal_name, d.stage, d.deal_date,
                d.contract_value, d.probability_pct, d.payment_terms_days,
                ch.name AS channel, s.name AS service_line
          FROM public.demo_deals d
          JOIN public.demo_companies c ON c.id = d.company_id
          JOIN public.demo_periods p ON p.id = d.period_id
          LEFT JOIN public.demo_channels ch ON ch.id = d.channel_id
          JOIN public.demo_service_lines s ON s.id = d.service_line_id
          WHERE c.slug = 'northstar-growth'
          ORDER BY d.deal_date, d.client_name`,
      sql`SELECT p.month_start, t.transaction_date, t.direction, t.category,
                t.description, t.counterparty, t.amount, t.cash_status,
                t.is_recurring, d.client_name AS related_client
          FROM public.demo_transactions t
          JOIN public.demo_companies c ON c.id = t.company_id
          JOIN public.demo_periods p ON p.id = t.period_id
          LEFT JOIN public.demo_deals d ON d.id = t.deal_id
          WHERE c.slug = 'northstar-growth'
          ORDER BY t.transaction_date, t.category`,
      sql`SELECT full_name, role, department, monthly_gross_cost, employment_status
          FROM public.demo_employees
          WHERE company_id = (SELECT id FROM public.demo_companies WHERE slug = 'northstar-growth' LIMIT 1)
          ORDER BY department, full_name`
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
      team: { monthly_payroll: number(payrollRows[0]?.monthly_payroll), size: number(payrollRows[0]?.team_size) },
      deals: dealRows.map(row => ({ month_start: String(row.month_start).slice(0, 10), client: row.client_name, deal: row.deal_name, stage: row.stage, date: String(row.deal_date).slice(0, 10), value: number(row.contract_value), probability_pct: number(row.probability_pct), payment_terms_days: number(row.payment_terms_days), channel: row.channel || 'Unassigned', service_line: row.service_line })),
      transactions: transactionRows.map(row => ({ month_start: String(row.month_start).slice(0, 10), date: String(row.transaction_date).slice(0, 10), direction: row.direction, category: row.category, description: row.description, counterparty: row.counterparty, amount: number(row.amount), status: row.cash_status, recurring: Boolean(row.is_recurring), related_client: row.related_client || '' })),
      employees: employeeRows.map(row => ({ name: row.full_name, role: row.role, department: row.department, monthly_cost: number(row.monthly_gross_cost), status: row.employment_status }))
    });
  } catch (error) {
    console.error('Universe 2 Neon data request failed:', error);
    return res.status(500).json({ error: 'Could not load demo data from Neon' });
  }
}
