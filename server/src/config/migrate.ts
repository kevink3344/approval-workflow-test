import client from './database';

type ColumnSpec = {
  name: string;
  ddl: string;
};

async function ensureColumns(tableName: string, columns: ColumnSpec[]) {
  for (const column of columns) {
    try {
      await client.execute(`ALTER TABLE ${tableName} ADD COLUMN ${column.ddl}`);
      console.log(`[migrations] Added ${tableName}.${column.name}`);
    } catch (error) {
      const message = (error as Error).message.toLowerCase();
      if (message.includes('duplicate column name')) {
        continue;
      }
      throw error;
    }
  }
}

export async function runMigrations() {
  await ensureColumns('approval_steps', [
    { name: 'slot_order', ddl: "slot_order INTEGER NOT NULL DEFAULT 0" },
    { name: 'group_id', ddl: 'group_id TEXT' },
    { name: 'resolution_mode', ddl: "resolution_mode TEXT NOT NULL DEFAULT 'all'" },
    { name: 'comment', ddl: 'comment TEXT' },
    { name: 'acted_at', ddl: 'acted_at TEXT' },
  ]);

  await ensureColumns('workflow_approval_slots', [
    { name: 'resolution_mode', ddl: "resolution_mode TEXT NOT NULL DEFAULT 'all'" },
  ]);
}