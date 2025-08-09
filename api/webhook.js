import fetch from 'node-fetch'; import { setUser } from './_db.js';
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).send('Method not allowed');
  const update=req.body; const BOT_TOKEN=process.env.BOT_TOKEN; const API=`https://api.telegram.org/bot${BOT_TOKEN}`;
  const PERIOD=parseInt(process.env.SUBSCRIPTION_PERIOD_SEC||2592000,10);
  try{
    if(update.pre_checkout_query){
      await fetch(`${API}/answerPreCheckoutQuery`,{ method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ pre_checkout_query_id: update.pre_checkout_query.id, ok: true }) });
    }
    if(update.message?.successful_payment){
      const m=update.message, chat_id=m.chat.id, user_id=String(m.from.id);
      const now=Math.floor(Date.now()/1000);
      await setUser(user_id,{ sub_last_paid_at: now, sub_period_sec: PERIOD });
      await fetch(`${API}/sendMessage`,{ method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ chat_id, text:'Оплата получена ✅ Подписка PRO активна.' }) });
    }
    return res.status(200).json({ ok:true });
  }catch(e){ console.error(e); return res.status(200).json({ ok:true }); }
}
