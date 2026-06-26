import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function upsertRole(pool: Pool, name: string) {
  const existing = await pool.query(`SELECT * FROM roles WHERE name = $1`, [name]);
  if (existing.rows[0]) return existing.rows[0];
  const res = await pool.query(
    `INSERT INTO roles (id, name, "createdAt") VALUES ($1, $2, NOW()) RETURNING *`,
    [uuidv4(), name],
  );
  return res.rows[0];
}

async function upsertUser(pool: Pool, data: any) {
  const existing = await pool.query(`SELECT * FROM users WHERE email = $1`, [data.email]);
  if (existing.rows[0]) return existing.rows[0];
  const res = await pool.query(`
    INSERT INTO users (id, name, email, password_hash, "roleId", "isActive", "createdAt", "updatedAt")
    VALUES ($1,$2,$3,$4,$5,true,NOW(),NOW()) RETURNING *
  `, [uuidv4(), data.name, data.email, data.passwordHash, data.roleId]);
  return res.rows[0];
}

async function upsertWarehouse(pool: Pool, data: any) {
  const existing = await pool.query(`SELECT * FROM warehouses WHERE code = $1`, [data.code]);
  if (existing.rows[0]) return existing.rows[0];
  const res = await pool.query(`
    INSERT INTO warehouses (id, code, name, address, "createdAt", "updatedAt")
    VALUES ($1,$2,$3,$4,NOW(),NOW()) RETURNING *
  `, [uuidv4(), data.code, data.name, data.address]);
  return res.rows[0];
}

async function upsertZone(pool: Pool, data: any) {
  const existing = await pool.query(
    `SELECT * FROM zones WHERE "warehouseId" = $1 AND code = $2`,
    [data.warehouseId, data.code],
  );
  if (existing.rows[0]) return existing.rows[0];
  const res = await pool.query(
    `INSERT INTO zones (id, "warehouseId", code, name) VALUES ($1,$2,$3,$4) RETURNING *`,
    [uuidv4(), data.warehouseId, data.code, data.name],
  );
  return res.rows[0];
}

async function upsertRack(pool: Pool, data: any) {
  const existing = await pool.query(`SELECT * FROM racks WHERE barcode = $1`, [data.barcode]);
  if (existing.rows[0]) return existing.rows[0];
  const res = await pool.query(`
    INSERT INTO racks (id, "zoneId", "rackCode", barcode, "binCount", "isActive")
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
  `, [uuidv4(), data.zoneId, data.rackCode, data.barcode, data.binCount, data.isActive]);
  return res.rows[0];
}

async function upsertCategory(pool: Pool, name: string) {
  const existing = await pool.query(`SELECT * FROM categories WHERE name = $1`, [name]);
  if (existing.rows[0]) return existing.rows[0];
  const res = await pool.query(`INSERT INTO categories (id, name) VALUES ($1,$2) RETURNING *`, [uuidv4(), name]);
  return res.rows[0];
}

async function upsertProduct(pool: Pool, data: any) {
  const existing = await pool.query(`SELECT * FROM products WHERE sku = $1`, [data.sku]);
  if (existing.rows[0]) return existing.rows[0];
  const res = await pool.query(`
    INSERT INTO products (id, "categoryId", sku, barcode, name, description, uom, "costPrice", "sellingPrice", "isBatchTracked")
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
  `, [uuidv4(), data.categoryId, data.sku, data.barcode, data.name, data.description,
      data.uom, data.costPrice, data.sellingPrice, data.isBatchTracked]);
  return res.rows[0];
}

async function upsertBatch(pool: Pool, data: any) {
  const existing = await pool.query(
    `SELECT * FROM batches WHERE "productId" = $1 AND "batchNumber" = $2`,
    [data.productId, data.batchNumber],
  );
  if (existing.rows[0]) return existing.rows[0];
  const res = await pool.query(`
    INSERT INTO batches (id, "productId", "batchNumber", "manufacturingDate", "expiryDate")
    VALUES ($1,$2,$3,$4,$5) RETURNING *
  `, [uuidv4(), data.productId, data.batchNumber, data.manufacturingDate, data.expiryDate]);
  return res.rows[0];
}

async function main() {
  console.log('Seeding database...');

  const roles = await Promise.all(
    ['SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'COUNTER', 'REVIEWER'].map((name) => upsertRole(pool, name)),
  );
  const roleMap = Object.fromEntries(roles.map((r: any) => [r.name, r]));
  console.log('Roles seeded:', roles.map((r: any) => r.name).join(', '));

  const adminHash = await bcrypt.hash('Admin@123456', 12);
  const userHash = await bcrypt.hash('Password@123', 12);

  await upsertUser(pool, { name: 'System Administrator', email: 'admin@warehouse.com', passwordHash: adminHash, roleId: roleMap['SUPER_ADMIN'].id });
  await upsertUser(pool, { name: 'Warehouse Manager', email: 'manager@warehouse.com', passwordHash: userHash, roleId: roleMap['WAREHOUSE_MANAGER'].id });
  await upsertUser(pool, { name: 'Stock Counter', email: 'counter@warehouse.com', passwordHash: userHash, roleId: roleMap['COUNTER'].id });
  await upsertUser(pool, { name: 'Count Reviewer', email: 'reviewer@warehouse.com', passwordHash: userHash, roleId: roleMap['REVIEWER'].id });
  console.log('Users seeded: admin, manager, counter, reviewer');

  const warehouse = await upsertWarehouse(pool, { code: 'WH-001', name: 'Main Distribution Center', address: '123 Logistics Park, Industrial Zone, City 10001' });
  console.log('Warehouse seeded:', warehouse.name);

  const zoneA = await upsertZone(pool, { warehouseId: warehouse.id, code: 'A', name: 'Zone A - Ambient Storage' });
  const zoneB = await upsertZone(pool, { warehouseId: warehouse.id, code: 'B', name: 'Zone B - Cold Storage' });
  console.log('Zones seeded: Zone A, Zone B');

  const rack1 = await upsertRack(pool, { zoneId: zoneA.id, rackCode: 'A-001', barcode: 'RACK-WH001-A-001', binCount: 5, isActive: true });
  const rack2 = await upsertRack(pool, { zoneId: zoneA.id, rackCode: 'A-002', barcode: 'RACK-WH001-A-002', binCount: 5, isActive: true });
  const rack3 = await upsertRack(pool, { zoneId: zoneB.id, rackCode: 'B-001', barcode: 'RACK-WH001-B-001', binCount: 3, isActive: true });
  console.log('Racks seeded: A-001, A-002, B-001');

  const catElectronics = await upsertCategory(pool, 'Electronics');
  const catIndustrial = await upsertCategory(pool, 'Industrial Parts');
  const catFMCG = await upsertCategory(pool, 'FMCG');
  console.log('Categories seeded: Electronics, Industrial Parts, FMCG');

  const p1 = await upsertProduct(pool, { categoryId: catElectronics.id, sku: 'SKU-EL-001', barcode: '8901000000001', name: 'USB-C Power Adapter 65W', description: 'Universal USB-C charger, 65W GaN technology', uom: 'PCS', costPrice: '18.50', sellingPrice: '29.99', isBatchTracked: false });
  const p2 = await upsertProduct(pool, { categoryId: catIndustrial.id, sku: 'SKU-IND-001', barcode: '8901000000002', name: 'Deep Groove Ball Bearing 6205-2RS', description: '25mm ID, 52mm OD, sealed bearing', uom: 'PCS', costPrice: '3.20', sellingPrice: '6.50', isBatchTracked: false });
  const p3 = await upsertProduct(pool, { categoryId: catFMCG.id, sku: 'SKU-FMCG-001', barcode: '8901000000003', name: 'Industrial Hand Sanitizer 500ml', description: '70% alcohol, kills 99.9% germs', uom: 'BTL', costPrice: '2.10', sellingPrice: '4.25', isBatchTracked: true });
  console.log('Products seeded: USB-C Adapter, Bearing, Hand Sanitizer');

  const batch1 = await upsertBatch(pool, { productId: p3.id, batchNumber: 'BATCH-2024-001', manufacturingDate: new Date('2024-01-01'), expiryDate: new Date('2026-01-01') });
  console.log('Batch seeded: BATCH-2024-001');

  for (const loc of [
    { warehouseId: warehouse.id, rackId: rack1.id, productId: p1.id, batchId: null, quantity: '250' },
    { warehouseId: warehouse.id, rackId: rack1.id, productId: p2.id, batchId: null, quantity: '1500' },
    { warehouseId: warehouse.id, rackId: rack2.id, productId: p2.id, batchId: null, quantity: '800' },
    { warehouseId: warehouse.id, rackId: rack3.id, productId: p3.id, batchId: batch1.id, quantity: '320' },
  ]) {
    const existing = await pool.query(`
      SELECT id FROM inventory_locations
      WHERE "warehouseId"=$1 AND ("rackId"=$2 OR ($2 IS NULL AND "rackId" IS NULL))
        AND "productId"=$3 AND ("batchId"=$4 OR ($4 IS NULL AND "batchId" IS NULL))
    `, [loc.warehouseId, loc.rackId, loc.productId, loc.batchId]);

    if (!existing.rows[0]) {
      await pool.query(`
        INSERT INTO inventory_locations (id, "warehouseId", "rackId", "productId", "batchId", quantity)
        VALUES ($1,$2,$3,$4,$5,$6)
      `, [uuidv4(), loc.warehouseId, loc.rackId, loc.productId, loc.batchId, loc.quantity]);
    }
  }
  console.log('Inventory locations seeded: 4 stock records');

  console.log('\nSeed complete!');
  console.log('\nTest credentials:');
  console.log('  SUPER_ADMIN:       admin@warehouse.com    / Admin@123456');
  console.log('  WAREHOUSE_MANAGER: manager@warehouse.com  / Password@123');
  console.log('  COUNTER:           counter@warehouse.com  / Password@123');
  console.log('  REVIEWER:          reviewer@warehouse.com / Password@123');
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
  .finally(() => pool.end());
