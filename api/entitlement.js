import { getUser, setUser } from './_db.js';
const TRIAL = 5*24*3600;

export default async function handler(req, res){
  const { initData, dev } = req.query;
  try{
    let user_id;
    if (dev) { user_id = 'dev-1'; }
    else {
      const p = new URLSearchParams(initData || '');
      const u = p.get('user'); if (!u) throw new Error('no user');
      user_id = String(JSON.parse(u).id);
    }
    let u = await getUser(user_id);
    const now = Math.floor(Date.now()/1000);
    if (!u) u = await setUser(user_id, { trial_started_at: now, trial_expires_at: now + TRIAL });
    const trial_left_s = Math.max(0, (u.trial_expires_at || 0) - now);
    const sub_active = !!(u.sub_last_paid_at && u.sub_period_sec && (u.sub_last_paid_at + u.sub_period_sec > now));
    res.status(200).json({ ok:true, trial_left_s, sub_active });
  }catch(e){
    res.status(200).json({ ok:true, trial_left_s:0, sub_active:false, note:'fallback-no-initdata' });
  }
}
