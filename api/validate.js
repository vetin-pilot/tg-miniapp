import crypto from 'crypto';
export default function handler(req, res){
  const initData = req.query.initData || '';
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) return res.status(500).json({ ok:false, error:'BOT_TOKEN is not set' });
  try{
    const url = new URLSearchParams(initData);
    const hash = url.get('hash'); url.delete('hash');
    const dataCheckString = [...url.entries()].map(([k,v])=>({k,v})).sort((a,b)=>a.k.localeCompare(b.k)).map(({k,v})=>`${k}=${v}`).join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const check = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
    res.status(200).json({ ok: check===hash });
  }catch(e){ res.status(400).json({ ok:false, error:e.message }); }
}
