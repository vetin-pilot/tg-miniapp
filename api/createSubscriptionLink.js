import fetch from 'node-fetch';
export default async function handler(req, res){
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const PRICE = parseInt(process.env.PRO_PRICE_STARS || '300', 10);
  const PERIOD = parseInt(process.env.SUBSCRIPTION_PERIOD_SEC || (30*24*3600), 10);
  if (!BOT_TOKEN) return res.status(500).json({ ok:false, error:'BOT_TOKEN missing' });

  const body = {
    title: 'Подписка PRO (мес)',
    description: '5 дней бесплатно, затем 300 ⭐/мес. Автопродление.',
    payload: `pro-month-${Date.now()}`,
    currency: 'XTR',
    provider_token: '',
    prices: [{ label:'PRO месяц', amount: PRICE }],
    subscription_period: PERIOD
  };
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
    method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body)
  });
  const j = await r.json();
  if (!j.ok) return res.status(400).json(j);
  res.status(200).json({ ok:true, link:j.result });
}
