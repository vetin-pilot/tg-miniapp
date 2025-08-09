import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const TABLE='users';
const COLUMNS={user_id:'TEXT PRIMARY KEY',trial_started_at:'INTEGER',trial_expires_at:'INTEGER',sub_last_paid_at:'INTEGER',sub_period_sec:'INTEGER'};
async function ensure(){await pool.query(`CREATE TABLE IF NOT EXISTS ${TABLE} (${Object.entries(COLUMNS).map(([k,v])=>`${k} ${v}`).join(', ')})`);
  const {rows}=await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name=$1`,[TABLE]);
  const ex=new Set(rows.map(r=>r.column_name)); for(const [c,d] of Object.entries(COLUMNS)){ if(!ex.has(c)) await pool.query(`ALTER TABLE ${TABLE} ADD COLUMN ${c} ${d}`); }}
async function ready(){await ensure();}
export async function getUser(user_id){await ready();const {rows}=await pool.query(`SELECT * FROM ${TABLE} WHERE user_id=$1`,[user_id]);return rows[0]||null;}
export async function setUser(user_id,patch){await ready();const {rows}=await pool.query(`SELECT * FROM ${TABLE} WHERE user_id=$1`,[user_id]);const cur=rows[0]||{};
  const next={trial_started_at:patch.trial_started_at??cur.trial_started_at??null,trial_expires_at:patch.trial_expires_at??cur.trial_expires_at??null,sub_last_paid_at:patch.sub_last_paid_at??cur.sub_last_paid_at??null,sub_period_sec:patch.sub_period_sec??cur.sub_period_sec??null};
  await pool.query(`INSERT INTO ${TABLE} (user_id,trial_started_at,trial_expires_at,sub_last_paid_at,sub_period_sec) VALUES ($1,$2,$3,$4,$5)
  ON CONFLICT (user_id) DO UPDATE SET trial_started_at=EXCLUDED.trial_started_at, trial_expires_at=EXCLUDED.trial_expires_at, sub_last_paid_at=EXCLUDED.sub_last_paid_at, sub_period_sec=EXCLUDED.sub_period_sec`,
  [user_id,next.trial_started_at,next.trial_expires_at,next.sub_last_paid_at,next.sub_period_sec]); return {user_id,...next};}
