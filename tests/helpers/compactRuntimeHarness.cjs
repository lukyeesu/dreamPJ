const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const legacy = require('./productionFixture.cjs');

const root = path.resolve(__dirname, '../..');
const itemId = n => `b1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const recipientId = n => `c1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function compactSql() {
  const ready = process.env.F2U_COMPACT_SQL_PATH || path.join(root, 'database_scripts/inventory_compact.sql');
  if (fs.existsSync(ready)) return fs.readFileSync(ready, 'utf8');
  const parts = ['compact_schema.sql.part', 'compact_core.sql.part', 'compact_production.sql.part'];
  return "BEGIN; SELECT set_config('flower.compact_build','v2',true);\n"
    + parts.map(name => fs.readFileSync(path.join(root, 'database_scripts/drafts', name), 'utf8')).join('\n')
    + '\nCOMMIT;';
}

async function assembleCompact(pg) {
  try { await pg.exec(compactSql()); }
  catch (error) { await pg.exec('ROLLBACK').catch(() => {}); throw error; }
}

async function createCompactFixture(t, { seed = true, staffIdType = 'uuid' } = {}) {
  const pg = await legacy.createProductionPgHarness({ staffIdType });
  t.after(() => pg.close());
  // The real master schema already defines this RPC as JSON. Catch live-upgrade
  // signature regressions that the deliberately small legacy fixture omits.
  await pg.exec("CREATE OR REPLACE FUNCTION public.get_inventory_analytics() RETURNS JSON LANGUAGE SQL AS $$ SELECT '{}'::json $$;");
  await assembleCompact(pg);
  if (seed) {
    await pg.query(`INSERT INTO inventory_items(id,code,name,item_type,unit,current_stock) VALUES
      ($1,'TAPE','Tape','consumable','piece',100),
      ($2,'FLOWER','Flower','reusable','piece',100),
      ($3,'SCISSORS','Scissors','asset','piece',0)`, [itemId(1), itemId(2), itemId(3)]);
    await pg.query("INSERT INTO asset_units(unit_code,item_id,status) VALUES ('SC-001',$1,'AVAILABLE'),('SC-002',$1,'AVAILABLE')", [itemId(3)]);
    for (let n = 1; n <= 10; n++) {
      await pg.query("INSERT INTO inventory_recipients(id,name,recipient_type) VALUES ($1,$2,'casual_helper')", [recipientId(n), `Helper ${n}`]);
    }
  }
  const cmd = async (action, payload, key = randomUUID()) =>
    (await pg.query('SELECT warehouse_dispatch($1,$2::jsonb,$3::uuid) AS result', [action, JSON.stringify(payload), key])).rows[0].result;
  const rpc = async (name, payload, key = randomUUID()) =>
    (await pg.query(`SELECT ${name}($1::jsonb,$2::uuid) AS result`, [JSON.stringify(payload), key])).rows[0].result;
  return { pg, cmd, rpc };
}

module.exports = { ...legacy, root, itemId, recipientId, compactSql, assembleCompact, createCompactFixture };
