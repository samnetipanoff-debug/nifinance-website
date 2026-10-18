-- Northstar Growth: fictional 3-month operating model for NIFINANCE Universe
-- Safe demo namespace: all objects use demo_ prefix. Run in Supabase SQL Editor.
-- Idempotent seed: fixed UUIDs and upserts; no production tables are altered.

create extension if not exists pgcrypto;

create table if not exists public.demo_companies (
  id uuid primary key,
  slug text unique not null,
  name text not null,
  industry text not null,
  currency char(3) not null default 'EUR',
  created_at timestamptz not null default now()
);

create table if not exists public.demo_periods (
  id uuid primary key,
  company_id uuid not null references public.demo_companies(id) on delete cascade,
  month_start date not null,
  month_end date not null,
  unique(company_id, month_start),
  check (month_end >= month_start)
);

create table if not exists public.demo_channels (
  id uuid primary key,
  company_id uuid not null references public.demo_companies(id) on delete cascade,
  name text not null,
  channel_type text not null check (channel_type in ('paid','organic','referral','outbound')),
  monthly_budget numeric(12,2) not null default 0,
  unique(company_id, name)
);

create table if not exists public.demo_employees (
  id uuid primary key,
  company_id uuid not null references public.demo_companies(id) on delete cascade,
  full_name text not null,
  role text not null,
  department text not null,
  monthly_gross_cost numeric(12,2) not null,
  employment_status text not null default 'active'
);

create table if not exists public.demo_service_lines (
  id uuid primary key,
  company_id uuid not null references public.demo_companies(id) on delete cascade,
  name text not null,
  delivery_cost_pct numeric(5,2) not null check (delivery_cost_pct between 0 and 100),
  unique(company_id, name)
);

create table if not exists public.demo_deals (
  id uuid primary key,
  company_id uuid not null references public.demo_companies(id) on delete cascade,
  period_id uuid not null references public.demo_periods(id),
  channel_id uuid references public.demo_channels(id),
  service_line_id uuid not null references public.demo_service_lines(id),
  client_name text not null,
  deal_name text not null,
  stage text not null check (stage in ('won','lost','open')),
  deal_date date not null,
  contract_value numeric(12,2) not null check (contract_value >= 0),
  probability_pct numeric(5,2) not null default 100 check (probability_pct between 0 and 100),
  payment_terms_days integer not null default 15
);

create table if not exists public.demo_marketing_metrics (
  id uuid primary key,
  company_id uuid not null references public.demo_companies(id) on delete cascade,
  period_id uuid not null references public.demo_periods(id),
  channel_id uuid not null references public.demo_channels(id),
  spend numeric(12,2) not null,
  impressions integer not null,
  clicks integer not null,
  leads integer not null,
  qualified_leads integer not null,
  opportunities integer not null,
  deals_won integer not null,
  attributed_revenue numeric(12,2) not null,
  unique(period_id, channel_id),
  check (clicks <= impressions and qualified_leads <= leads and opportunities <= qualified_leads)
);

create table if not exists public.demo_transactions (
  id uuid primary key,
  company_id uuid not null references public.demo_companies(id) on delete cascade,
  period_id uuid not null references public.demo_periods(id),
  transaction_date date not null,
  direction text not null check (direction in ('income','expense')),
  category text not null,
  description text not null,
  counterparty text not null,
  amount numeric(12,2) not null check (amount > 0),
  cash_status text not null check (cash_status in ('paid','received','due')),
  channel_id uuid references public.demo_channels(id),
  employee_id uuid references public.demo_employees(id),
  deal_id uuid references public.demo_deals(id),
  is_recurring boolean not null default false
);

create index if not exists demo_deals_company_period_idx on public.demo_deals(company_id, period_id);
create index if not exists demo_transactions_company_period_idx on public.demo_transactions(company_id, period_id);
create index if not exists demo_marketing_company_period_idx on public.demo_marketing_metrics(company_id, period_id);

-- Dashboard-ready views: core numbers are calculated from normalized source tables.
create or replace view public.demo_monthly_pnl as
select c.id as company_id, c.name as company_name, p.id as period_id, p.month_start,
  coalesce(s.revenue,0)::numeric(12,2) as recognized_revenue,
  coalesce(x.operating_expenses,0)::numeric(12,2) as operating_expenses,
  (coalesce(s.revenue,0)-coalesce(x.operating_expenses,0))::numeric(12,2) as operating_profit,
  case when coalesce(s.revenue,0)=0 then 0
       else round((coalesce(s.revenue,0)-coalesce(x.operating_expenses,0))/s.revenue*100,2) end as operating_margin_pct
from public.demo_companies c
join public.demo_periods p on p.company_id=c.id
left join (
  select period_id, company_id, sum(contract_value) as revenue
  from public.demo_deals where stage='won' group by period_id, company_id
) s on s.period_id=p.id and s.company_id=c.id
left join (
  select period_id, company_id, sum(amount) as operating_expenses
  from public.demo_transactions where direction='expense' and category <> 'Owner distribution'
  group by period_id, company_id
) x on x.period_id=p.id and x.company_id=c.id;

create or replace view public.demo_marketing_dashboard as
select c.name as company_name, p.month_start, ch.name as channel,
  m.spend, m.impressions, m.clicks, m.leads, m.qualified_leads, m.opportunities, m.deals_won,
  m.attributed_revenue,
  round(m.spend/nullif(m.leads,0),2) as cost_per_lead,
  round(m.spend/nullif(m.qualified_leads,0),2) as cost_per_qualified_lead,
  round(m.clicks::numeric/nullif(m.impressions,0)*100,2) as ctr_pct,
  round(m.leads::numeric/nullif(m.clicks,0)*100,2) as lead_conversion_pct,
  round(m.attributed_revenue/nullif(m.spend,0),2) as attributed_roas
from public.demo_marketing_metrics m
join public.demo_companies c on c.id=m.company_id
join public.demo_periods p on p.id=m.period_id
join public.demo_channels ch on ch.id=m.channel_id;

insert into public.demo_companies(id,slug,name,industry,currency) values
('10000000-0000-4000-8000-000000000001','northstar-growth','Northstar Growth','Digital marketing agency','EUR')
on conflict(id) do update set name=excluded.name, industry=excluded.industry, currency=excluded.currency;

insert into public.demo_periods(id,company_id,month_start,month_end) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','2026-01-01','2026-01-31'),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','2026-02-01','2026-02-28'),
('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','2026-03-01','2026-03-31')
on conflict(id) do update set month_start=excluded.month_start, month_end=excluded.month_end;

insert into public.demo_channels(id,company_id,name,channel_type,monthly_budget) values
('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Google Search Ads','paid',2400),
('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Meta Ads','paid',1500),
('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','LinkedIn Ads','paid',900),
('30000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','SEO & Content','organic',1200),
('30000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','Referral Partners','referral',500),
('30000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001','Outbound Sales','outbound',650)
on conflict(id) do update set name=excluded.name, channel_type=excluded.channel_type, monthly_budget=excluded.monthly_budget;

insert into public.demo_employees(id,company_id,full_name,role,department,monthly_gross_cost) values
('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Mila Petrović','Managing Director','Leadership',4200),
('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Luka Jovanović','Performance Lead','Marketing',3200),
('40000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','Ana Marković','SEO Specialist','Marketing',2500),
('40000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','Ivan Nikolić','Account Manager','Client Service',2600),
('40000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','Sara Ilić','Designer','Creative',2200),
('40000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001','Marko Simić','Sales Manager','Sales',2800),
('40000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000001','Jelena Popov','Content Strategist','Creative',2100),
('40000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000001','Stefan Kovač','Web Developer','Delivery',3000)
on conflict(id) do update set role=excluded.role, department=excluded.department, monthly_gross_cost=excluded.monthly_gross_cost;

insert into public.demo_service_lines(id,company_id,name,delivery_cost_pct) values
('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Performance Marketing',32),
('50000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','SEO & Content Retainer',38),
('50000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','Website & Landing Pages',48),
('50000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','Strategy & Analytics',25)
on conflict(id) do update set delivery_cost_pct=excluded.delivery_cost_pct;

-- Won deals are the source of recognized revenue. The source channel connects sales to acquisition.
insert into public.demo_deals(id,company_id,period_id,channel_id,service_line_id,client_name,deal_name,stage,deal_date,contract_value,probability_pct,payment_terms_days) values
('60000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','Adria Home','Paid media retainer','won','2026-01-05',6500,100,15),
('60000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000004','50000000-0000-4000-8000-000000000002','GreenBasket','SEO monthly retainer','won','2026-01-08',4800,100,30),
('60000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003','Nova Dental','Landing page + campaign','won','2026-01-12',7200,100,15),
('60000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000005','50000000-0000-4000-8000-000000000004','BluePeak SaaS','Growth strategy','won','2026-01-15',5600,100,30),
('60000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000006','50000000-0000-4000-8000-000000000001','UrbanFit','Performance retainer','won','2026-01-21',8500,100,15),
('60000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000003','Finwise','Website project','won','2026-01-26',12400,100,30),
('60000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','Adria Home','Paid media + CRO','won','2026-02-04',7800,100,15),
('60000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000004','50000000-0000-4000-8000-000000000002','GreenBasket','SEO retainer','won','2026-02-06',5000,100,30),
('60000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003','Nova Dental','Campaign optimisation','won','2026-02-11',6800,100,15),
('60000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000005','50000000-0000-4000-8000-000000000004','BluePeak SaaS','Analytics implementation','won','2026-02-15',6400,100,30),
('60000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000006','50000000-0000-4000-8000-000000000001','UrbanFit','Performance retainer','won','2026-02-20',8900,100,15),
('60000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000003','Finwise','Website milestone','won','2026-02-24',16100,100,30),
('60000000-0000-4000-8000-000000000013','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','Adria Home','Paid media + CRO','won','2026-03-03',9200,100,15),
('60000000-0000-4000-8000-000000000014','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000004','50000000-0000-4000-8000-000000000002','GreenBasket','SEO retainer','won','2026-03-05',5200,100,30),
('60000000-0000-4000-8000-000000000015','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003','Nova Dental','Website conversion sprint','won','2026-03-10',8200,100,15),
('60000000-0000-4000-8000-000000000016','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000005','50000000-0000-4000-8000-000000000004','BluePeak SaaS','Growth strategy','won','2026-03-14',7600,100,30),
('60000000-0000-4000-8000-000000000017','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000006','50000000-0000-4000-8000-000000000001','UrbanFit','Performance retainer','won','2026-03-19',9800,100,15),
('60000000-0000-4000-8000-000000000018','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000003','Finwise','Website launch balance','won','2026-03-25',18000,100,30)
on conflict(id) do update set contract_value=excluded.contract_value, stage=excluded.stage, deal_date=excluded.deal_date, channel_id=excluded.channel_id;

-- Channel metrics: plausible funnel data. Revenue attribution is indicative and may overlap with retainer renewals.
insert into public.demo_marketing_metrics(id,company_id,period_id,channel_id,spend,impressions,clicks,leads,qualified_leads,opportunities,deals_won,attributed_revenue) values
('70000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',2100,88000,2640,84,34,15,1,6500),
('70000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002',1350,96000,1920,72,25,10,1,7200),
('70000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003',820,26000,520,24,13,7,1,12400),
('70000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000004',1050,41000,1230,46,22,9,1,4800),
('70000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000005',400,7800,390,18,11,6,1,5600),
('70000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000006',600,5200,310,16,8,5,1,8500),
('70000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001',2350,94000,3008,96,41,18,1,7800),
('70000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002',1500,102000,2244,86,31,13,1,6800),
('70000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003',900,28000,616,29,16,8,1,16100),
('70000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000004',1150,45000,1440,55,27,11,1,5000),
('70000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000005',450,8600,430,20,13,7,1,6400),
('70000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000006',650,5600,336,18,10,6,1,8900),
('70000000-0000-4000-8000-000000000013','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000001',2550,102000,3570,112,50,23,1,9200),
('70000000-0000-4000-8000-000000000014','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000002',1650,111000,2664,102,39,17,1,8200),
('70000000-0000-4000-8000-000000000015','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003',950,31000,744,36,21,11,1,18000),
('70000000-0000-4000-8000-000000000016','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000004',1200,49000,1666,64,34,15,1,5200),
('70000000-0000-4000-8000-000000000017','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000005',500,9400,517,25,16,9,1,7600),
('70000000-0000-4000-8000-000000000018','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000006',700,6100,390,22,13,8,1,9800)
on conflict(id) do update set spend=excluded.spend, impressions=excluded.impressions, clicks=excluded.clicks, leads=excluded.leads, qualified_leads=excluded.qualified_leads, opportunities=excluded.opportunities, deals_won=excluded.deals_won, attributed_revenue=excluded.attributed_revenue;

-- Expenses and cash movements. Payroll is one monthly payroll run; salary composition is available in demo_employees.
insert into public.demo_transactions(id,company_id,period_id,transaction_date,direction,category,description,counterparty,amount,cash_status,channel_id,employee_id,deal_id,is_recurring) values
('80000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','2026-01-05','expense','Paid media','Google Ads campaign budget','Google',2100,'paid','30000000-0000-4000-8000-000000000001',null,null,true),
('80000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','2026-01-06','expense','Paid media','Meta campaign budget','Meta',1350,'paid','30000000-0000-4000-8000-000000000002',null,null,true),
('80000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','2026-01-07','expense','Paid media','LinkedIn campaign budget','LinkedIn',820,'paid','30000000-0000-4000-8000-000000000003',null,null,true),
('80000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','2026-01-31','expense','Payroll','January gross employment costs','Team payroll',22600,'paid',null,null,null,true),
('80000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','2026-01-03','expense','Rent','Office rent and service charge','Office landlord',1800,'paid',null,null,null,true),
('80000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','2026-01-10','expense','Software','CRM, analytics, design and project tools','Software vendors',1180,'paid',null,null,null,true),
('80000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','2026-01-12','expense','Contractors','Video editing and specialist copywriting','Freelancers',1900,'paid',null,null,null,false),
('80000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','2026-01-15','expense','Utilities & internet','Office utilities and connectivity','Utility providers',260,'paid',null,null,null,true),
('80000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','2026-01-18','expense','Travel & client meetings','Client workshops and local travel','Transport / hospitality',420,'paid',null,null,null,false),
('80000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','2026-01-20','expense','Professional services','Accounting and legal retainer','Accounting firm',480,'paid',null,null,null,true),
('80000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','2026-01-25','expense','Insurance & bank fees','Business insurance and transaction fees','Insurer / bank',210,'paid',null,null,null,true),
('80000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','2026-01-28','expense','Training','Analytics and platform certification','Training provider',350,'paid',null,null,null,false),
('80000000-0000-4000-8000-000000000013','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','2026-02-05','expense','Paid media','Google Ads campaign budget','Google',2350,'paid','30000000-0000-4000-8000-000000000001',null,null,true),
('80000000-0000-4000-8000-000000000014','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','2026-02-06','expense','Paid media','Meta campaign budget','Meta',1500,'paid','30000000-0000-4000-8000-000000000002',null,null,true),
('80000000-0000-4000-8000-000000000015','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','2026-02-07','expense','Paid media','LinkedIn campaign budget','LinkedIn',900,'paid','30000000-0000-4000-8000-000000000003',null,null,true),
('80000000-0000-4000-8000-000000000016','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','2026-02-28','expense','Payroll','February gross employment costs','Team payroll',22600,'paid',null,null,null,true),
('80000000-0000-4000-8000-000000000017','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','2026-02-03','expense','Rent','Office rent and service charge','Office landlord',1800,'paid',null,null,null,true),
('80000000-0000-4000-8000-000000000018','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','2026-02-10','expense','Software','CRM, analytics, design and project tools','Software vendors',1220,'paid',null,null,null,true),
('80000000-0000-4000-8000-000000000019','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','2026-02-12','expense','Contractors','Overflow development and video editing','Freelancers',2400,'paid',null,null,null,false),
('80000000-0000-4000-8000-000000000020','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','2026-02-15','expense','Utilities & internet','Office utilities and connectivity','Utility providers',275,'paid',null,null,null,true),
('80000000-0000-4000-8000-000000000021','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','2026-02-18','expense','Travel & client meetings','Client workshop and travel','Transport / hospitality',560,'paid',null,null,null,false),
('80000000-0000-4000-8000-000000000022','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','2026-02-20','expense','Professional services','Accounting and legal retainer','Accounting firm',480,'paid',null,null,null,true),
('80000000-0000-4000-8000-000000000023','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','2026-02-24','expense','Insurance & bank fees','Business insurance and transaction fees','Insurer / bank',230,'paid',null,null,null,true),
('80000000-0000-4000-8000-000000000024','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','2026-02-26','expense','Equipment','Monitor and laptop peripherals','IT supplier',680,'paid',null,null,null,false),
('80000000-0000-4000-8000-000000000025','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','2026-03-05','expense','Paid media','Google Ads campaign budget','Google',2550,'paid','30000000-0000-4000-8000-000000000001',null,null,true),
('80000000-0000-4000-8000-000000000026','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','2026-03-06','expense','Paid media','Meta campaign budget','Meta',1650,'paid','30000000-0000-4000-8000-000000000002',null,null,true),
('80000000-0000-4000-8000-000000000027','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','2026-03-07','expense','Paid media','LinkedIn campaign budget','LinkedIn',950,'paid','30000000-0000-4000-8000-000000000003',null,null,true),
('80000000-0000-4000-8000-000000000028','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','2026-03-31','expense','Payroll','March gross employment costs','Team payroll',22600,'paid',null,null,null,true),
('80000000-0000-4000-8000-000000000029','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','2026-03-03','expense','Rent','Office rent and service charge','Office landlord',1800,'paid',null,null,null,true),
('80000000-0000-4000-8000-000000000030','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','2026-03-10','expense','Software','CRM, analytics, design and project tools','Software vendors',1260,'paid',null,null,null,true),
('80000000-0000-4000-8000-000000000031','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','2026-03-12','expense','Contractors','Freelance copywriting and landing page QA','Freelancers',2100,'paid',null,null,null,false),
('80000000-0000-4000-8000-000000000032','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','2026-03-15','expense','Utilities & internet','Office utilities and connectivity','Utility providers',290,'paid',null,null,null,true),
('80000000-0000-4000-8000-000000000033','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','2026-03-18','expense','Travel & client meetings','Client workshops and travel','Transport / hospitality',620,'paid',null,null,null,false),
('80000000-0000-4000-8000-000000000034','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','2026-03-20','expense','Professional services','Accounting and legal retainer','Accounting firm',480,'paid',null,null,null,true),
('80000000-0000-4000-8000-000000000035','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','2026-03-24','expense','Insurance & bank fees','Business insurance and transaction fees','Insurer / bank',245,'paid',null,null,null,true),
('80000000-0000-4000-8000-000000000036','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','2026-03-27','expense','Sales commission','New business commission','Sales team',900,'paid',null,null,null,false)
on conflict(id) do update set transaction_date=excluded.transaction_date, category=excluded.category, description=excluded.description, amount=excluded.amount, cash_status=excluded.cash_status;

-- Non-paid channels also have delivery/activation costs; these reconcile to the channel spend metrics.
insert into public.demo_transactions(id,company_id,period_id,transaction_date,direction,category,description,counterparty,amount,cash_status,channel_id,employee_id,deal_id,is_recurring) values
('82000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','2026-01-09','expense','Content production','SEO articles and technical content','Freelance content team',1050,'paid','30000000-0000-4000-8000-000000000004',null,null,true),
('82000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','2026-01-11','expense','Partner commissions','Referral partner fees','Agency partners',400,'paid','30000000-0000-4000-8000-000000000005',null,null,false),
('82000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','2026-01-14','expense','Sales tools & data','Outbound data and prospecting tools','Sales tool vendors',600,'paid','30000000-0000-4000-8000-000000000006',null,null,true),
('82000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','2026-02-09','expense','Content production','SEO articles and technical content','Freelance content team',1150,'paid','30000000-0000-4000-8000-000000000004',null,null,true),
('82000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','2026-02-11','expense','Partner commissions','Referral partner fees','Agency partners',450,'paid','30000000-0000-4000-8000-000000000005',null,null,false),
('82000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','2026-02-14','expense','Sales tools & data','Outbound data and prospecting tools','Sales tool vendors',650,'paid','30000000-0000-4000-8000-000000000006',null,null,true),
('82000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','2026-03-09','expense','Content production','SEO articles and technical content','Freelance content team',1200,'paid','30000000-0000-4000-8000-000000000004',null,null,true),
('82000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','2026-03-11','expense','Partner commissions','Referral partner fees','Agency partners',500,'paid','30000000-0000-4000-8000-000000000005',null,null,false),
('82000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','2026-03-14','expense','Sales tools & data','Outbound data and prospecting tools','Sales tool vendors',700,'paid','30000000-0000-4000-8000-000000000006',null,null,true)
on conflict(id) do update set amount=excluded.amount, description=excluded.description, cash_status=excluded.cash_status;

-- Client receipts intentionally lag some invoices to create a realistic receivables/cash-flow story.
insert into public.demo_transactions(id,company_id,period_id,transaction_date,direction,category,description,counterparty,amount,cash_status,channel_id,employee_id,deal_id,is_recurring) values
('81000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','2026-01-20','income','Client receipts','Retainer and project milestone payment','Adria Home',6500,'received','30000000-0000-4000-8000-000000000001',null,'60000000-0000-4000-8000-000000000001',false),
('81000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','2026-01-28','income','Client receipts','SEO retainer payment','GreenBasket',4800,'received','30000000-0000-4000-8000-000000000004',null,'60000000-0000-4000-8000-000000000002',false),
('81000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','2026-01-29','income','Client receipts','Project advance; balance due next month','Finwise',6200,'received','30000000-0000-4000-8000-000000000003',null,'60000000-0000-4000-8000-000000000006',false),
('81000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','2026-02-05','income','Client receipts','January project balance','Finwise',6200,'received','30000000-0000-4000-8000-000000000003',null,'60000000-0000-4000-8000-000000000006',false),
('81000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','2026-02-19','income','Client receipts','Paid media retainer payment','UrbanFit',8500,'received','30000000-0000-4000-8000-000000000006',null,'60000000-0000-4000-8000-000000000005',false),
('81000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','2026-02-22','income','Client receipts','February campaign payment','Nova Dental',6800,'received','30000000-0000-4000-8000-000000000002',null,'60000000-0000-4000-8000-000000000009',false),
('81000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','2026-03-05','income','Client receipts','SEO retainer payment','GreenBasket',5000,'received','30000000-0000-4000-8000-000000000004',null,'60000000-0000-4000-8000-000000000008',false),
('81000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','2026-03-12','income','Client receipts','Website project milestone','Finwise',9000,'received','30000000-0000-4000-8000-000000000003',null,'60000000-0000-4000-8000-000000000012',false),
('81000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','2026-03-20','income','Client receipts','March retainer payment','Adria Home',9200,'received','30000000-0000-4000-8000-000000000001',null,'60000000-0000-4000-8000-000000000013',false)
on conflict(id) do update set transaction_date=excluded.transaction_date, amount=excluded.amount, cash_status=excluded.cash_status, deal_id=excluded.deal_id;

-- Quick integrity check after import:
-- select * from public.demo_monthly_pnl order by month_start;
-- select * from public.demo_marketing_dashboard order by month_start, channel;
