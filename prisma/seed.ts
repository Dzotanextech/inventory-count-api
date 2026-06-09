import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ─── Roles ─────────────────────────────────────────────────────────────────
  const roles = await Promise.all(
    ['SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'COUNTER', 'REVIEWER'].map((name) =>
      prisma.role.upsert({ where: { name }, update: {}, create: { name } }),
    ),
  );

  const roleMap = Object.fromEntries(roles.map((r) => [r.name, r]));
  console.log('Roles seeded:', roles.map((r) => r.name).join(', '));

  // ─── Users ─────────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('Admin@123456', 12);
  const userHash = await bcrypt.hash('Password@123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@warehouse.com' },
    update: {},
    create: {
      name: 'System Administrator',
      email: 'admin@warehouse.com',
      passwordHash: adminHash,
      roleId: roleMap['SUPER_ADMIN'].id,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@warehouse.com' },
    update: {},
    create: {
      name: 'Warehouse Manager',
      email: 'manager@warehouse.com',
      passwordHash: userHash,
      roleId: roleMap['WAREHOUSE_MANAGER'].id,
    },
  });

  const counter = await prisma.user.upsert({
    where: { email: 'counter@warehouse.com' },
    update: {},
    create: {
      name: 'Stock Counter',
      email: 'counter@warehouse.com',
      passwordHash: userHash,
      roleId: roleMap['COUNTER'].id,
    },
  });

  const reviewer = await prisma.user.upsert({
    where: { email: 'reviewer@warehouse.com' },
    update: {},
    create: {
      name: 'Count Reviewer',
      email: 'reviewer@warehouse.com',
      passwordHash: userHash,
      roleId: roleMap['REVIEWER'].id,
    },
  });

  console.log('Users seeded: admin, manager, counter, reviewer');

  // ─── Warehouse ─────────────────────────────────────────────────────────────
  const warehouse = await prisma.warehouse.upsert({
    where: { code: 'WH-001' },
    update: {},
    create: {
      code: 'WH-001',
      name: 'Main Distribution Center',
      address: '123 Logistics Park, Industrial Zone, City 10001',
    },
  });

  console.log('Warehouse seeded:', warehouse.name);

  // ─── Zones ─────────────────────────────────────────────────────────────────
  const zoneA = await prisma.zone.upsert({
    where: { warehouseId_code: { warehouseId: warehouse.id, code: 'A' } },
    update: {},
    create: { warehouseId: warehouse.id, code: 'A', name: 'Zone A - Ambient Storage' },
  });

  const zoneB = await prisma.zone.upsert({
    where: { warehouseId_code: { warehouseId: warehouse.id, code: 'B' } },
    update: {},
    create: { warehouseId: warehouse.id, code: 'B', name: 'Zone B - Cold Storage' },
  });

  console.log('Zones seeded: Zone A, Zone B');

  // ─── Racks ─────────────────────────────────────────────────────────────────
  const rack1 = await prisma.rack.upsert({
    where: { barcode: 'RACK-WH001-A-001' },
    update: {},
    create: {
      zoneId: zoneA.id,
      rackCode: 'A-001',
      barcode: 'RACK-WH001-A-001',
      binCount: 5,
      isActive: true,
    },
  });

  const rack2 = await prisma.rack.upsert({
    where: { barcode: 'RACK-WH001-A-002' },
    update: {},
    create: {
      zoneId: zoneA.id,
      rackCode: 'A-002',
      barcode: 'RACK-WH001-A-002',
      binCount: 5,
      isActive: true,
    },
  });

  const rack3 = await prisma.rack.upsert({
    where: { barcode: 'RACK-WH001-B-001' },
    update: {},
    create: {
      zoneId: zoneB.id,
      rackCode: 'B-001',
      barcode: 'RACK-WH001-B-001',
      binCount: 3,
      isActive: true,
    },
  });

  console.log('Racks seeded: A-001, A-002, B-001');

  // ─── Categories ────────────────────────────────────────────────────────────
  const catElectronics = await prisma.category.upsert({
    where: { name: 'Electronics' },
    update: {},
    create: { name: 'Electronics' },
  });

  const catIndustrial = await prisma.category.upsert({
    where: { name: 'Industrial Parts' },
    update: {},
    create: { name: 'Industrial Parts' },
  });

  const catFMCG = await prisma.category.upsert({
    where: { name: 'FMCG' },
    update: {},
    create: { name: 'FMCG' },
  });

  console.log('Categories seeded: Electronics, Industrial Parts, FMCG');

  // ─── Products ──────────────────────────────────────────────────────────────
  const p1 = await prisma.product.upsert({
    where: { sku: 'SKU-EL-001' },
    update: {},
    create: {
      categoryId: catElectronics.id,
      sku: 'SKU-EL-001',
      barcode: '8901000000001',
      name: 'USB-C Power Adapter 65W',
      description: 'Universal USB-C charger, 65W GaN technology',
      uom: 'PCS',
      costPrice: '18.50',
      sellingPrice: '29.99',
      isBatchTracked: false,
    },
  });

  const p2 = await prisma.product.upsert({
    where: { sku: 'SKU-IND-001' },
    update: {},
    create: {
      categoryId: catIndustrial.id,
      sku: 'SKU-IND-001',
      barcode: '8901000000002',
      name: 'Deep Groove Ball Bearing 6205-2RS',
      description: '25mm ID, 52mm OD, sealed bearing',
      uom: 'PCS',
      costPrice: '3.20',
      sellingPrice: '6.50',
      isBatchTracked: false,
    },
  });

  const p3 = await prisma.product.upsert({
    where: { sku: 'SKU-FMCG-001' },
    update: {},
    create: {
      categoryId: catFMCG.id,
      sku: 'SKU-FMCG-001',
      barcode: '8901000000003',
      name: 'Industrial Hand Sanitizer 500ml',
      description: '70% alcohol, kills 99.9% germs',
      uom: 'BTL',
      costPrice: '2.10',
      sellingPrice: '4.25',
      isBatchTracked: true,
    },
  });

  console.log('Products seeded: USB-C Adapter, Bearing, Hand Sanitizer');

  // ─── Batches (for batch-tracked products) ──────────────────────────────────
  const batch1 = await prisma.batch.upsert({
    where: { productId_batchNumber: { productId: p3.id, batchNumber: 'BATCH-2024-001' } },
    update: {},
    create: {
      productId: p3.id,
      batchNumber: 'BATCH-2024-001',
      manufacturingDate: new Date('2024-01-01'),
      expiryDate: new Date('2026-01-01'),
    },
  });

  console.log('Batch seeded: BATCH-2024-001');

  // ─── Inventory Locations (initial stock) ───────────────────────────────────
  const locationsData = [
    { warehouseId: warehouse.id, rackId: rack1.id, productId: p1.id, batchId: null, quantity: '250' },
    { warehouseId: warehouse.id, rackId: rack1.id, productId: p2.id, batchId: null, quantity: '1500' },
    { warehouseId: warehouse.id, rackId: rack2.id, productId: p2.id, batchId: null, quantity: '800' },
    { warehouseId: warehouse.id, rackId: rack3.id, productId: p3.id, batchId: batch1.id, quantity: '320' },
  ];

  for (const loc of locationsData) {
    const existing = await prisma.inventoryLocation.findFirst({
      where: {
        warehouseId: loc.warehouseId,
        rackId: loc.rackId,
        productId: loc.productId,
        batchId: loc.batchId,
      },
    });

    if (!existing) {
      await prisma.inventoryLocation.create({ data: loc });
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
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
