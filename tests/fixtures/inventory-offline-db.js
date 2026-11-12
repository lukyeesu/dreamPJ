const rows = new Map();
export const db = new Proxy({}, { get: (_, table) => ({
  toArray: async () => [...(rows.get(table) || [])],
  bulkPut: async values => rows.set(table, values),
  clear: async () => rows.delete(table),
  delete: async id => rows.set(table, (rows.get(table) || []).filter(row => row.id !== id))
}) });
