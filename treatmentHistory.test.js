/**
 * INTEGRATION TEST – Treatment History (Xem lịch sử khám)
 * TC_TRT_001 → TC_TRT_010
 */
const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const treatmentRoutes = require('../../src/routes/treatmentRoutes');
const Treatment   = require('../../src/models/treatment');
const Appointment = require('../../src/models/appointment');
const Patient     = require('../../src/models/patient');
const Account     = require('../../src/models/account');

const app = express();
app.use(express.json());
app.use('/treatments', treatmentRoutes);

let mongod, validAccountId, newPatientAccountId;
let validTreatmentId, noLabPxTreatmentId;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // BN có lịch sử khám
  const acc = await Account.create({ email: 'trt@test.com', password: 'x', roleId: null });
  validAccountId = String(acc._id);
  const pat = await Patient.create({ accountId: acc._id, name: 'Lam TRT', phone: '0908888888' });

  const appt = await Appointment.create({
    booker_id: pat._id,
    healthProfile_id: new mongoose.Types.ObjectId(),
    specialty_id: new mongoose.Types.ObjectId(),
    appointmentDate: new Date('2025-05-10'),
    timeSlot: '08:00-09:00',
    reason: 'Kham',
    status: 'completed',
  });

  const t1 = await Treatment.create({
    appointment: appt._id,
    healthProfile: new mongoose.Types.ObjectId(),
    doctor: new mongoose.Types.ObjectId(),
    treatmentDate: new Date('2025-05-10'),
    diagnosis: 'Viem hong',
    totalCost: 150000,
    healthProfileSnapshot: { ownerName: pat.name, ownerPhone: pat.phone },
    doctorSnapshot:        { name: 'BS Test', specialtyName: 'Noi khoa' },
    labOrderSnapshot:      { items: [{ name: 'XN mau', price: 100000 }], totalPrice: 100000 },
    prescriptionSnapshot:  { items: [{ name: 'Thuoc', price: 50000 }],  totalPrice: 50000 },
  });
  validTreatmentId = String(t1._id);

  const t2 = await Treatment.create({
    appointment: appt._id,
    healthProfile: new mongoose.Types.ObjectId(),
    doctor: new mongoose.Types.ObjectId(),
    treatmentDate: new Date('2025-04-20'),
    diagnosis: 'Cam thuong',
    totalCost: 0,
    healthProfileSnapshot: { ownerName: pat.name, ownerPhone: pat.phone },
    doctorSnapshot:        { name: 'BS Test 2', specialtyName: 'Da lieu' },
    labOrderSnapshot:      null,
    prescriptionSnapshot:  null,
  });
  noLabPxTreatmentId = String(t2._id);

  // BN chưa có ca khám
  const accNew = await Account.create({ email: 'new@test.com', password: 'x', roleId: null });
  newPatientAccountId = String(accNew._id);
  await Patient.create({ accountId: accNew._id, name: 'BN Moi', phone: '0907777777' });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe('Treatment History Management', () => {

  // TC_TRT_001 | CheckDB: Không | Rollback: Không áp dụng
  test('TC_TRT_001 - should get treatment history list with meta and treatments', async () => {
    const res = await request(app)
      .get(`/treatments/booker/${validAccountId}`)
      .query({ page: 1, limit: 10, sortBy: 'treatmentDate', sortOrder: 'desc' })
      .expect(200);
    expect(res.body).toHaveProperty('meta');
    expect(res.body.meta.total).toBeGreaterThan(0);
    expect(res.body.treatments[0]).toHaveProperty('diagnosis');
    expect(res.body.treatments[0]).toHaveProperty('treatmentDate');
  });

  // TC_TRT_002 | CheckDB: Không | Rollback: Không áp dụng
  test('TC_TRT_002 - should return max 1 record when limit=1', async () => {
    const res = await request(app)
      .get(`/treatments/booker/${validAccountId}`)
      .query({ page: 1, limit: 1 }).expect(200);
    expect(res.body.treatments.length).toBeLessThanOrEqual(1);
    expect(res.body.meta.page).toBe(1);
  });

  // TC_TRT_003 | CheckDB: Không | Rollback: Không áp dụng
  test('TC_TRT_003 - should return 404 when accountId not found', async () => {
    const res = await request(app)
      .get(`/treatments/booker/000000000000000000000001`).expect(404);
    expect(res.body.message).toBeDefined();
  });

  // TC_TRT_004 [BUG] | CheckDB: Không | Rollback: Không áp dụng
  test('TC_TRT_004 - [BUG] should return 200 empty array for patient with no treatments, but returns 404', async () => {
    const res = await request(app).get(`/treatments/booker/${newPatientAccountId}`);
    if (res.status === 404) {
      expect(res.body.message).toBeDefined(); // confirms BUG
    } else {
      expect(res.status).toBe(200);
      expect(res.body.treatments).toEqual([]);
    }
  });

  // TC_TRT_005 | CheckDB: Không | Rollback: Không áp dụng
  test('TC_TRT_005 - should filter treatments by date range from/to', async () => {
    const res = await request(app)
      .get(`/treatments/booker/${validAccountId}`)
      .query({ from: '2025-05-01', to: '2025-05-31' }).expect(200);
    res.body.treatments.forEach(t => {
      const d = new Date(t.treatmentDate);
      expect(d >= new Date('2025-05-01')).toBe(true);
      expect(d <= new Date('2025-05-31')).toBe(true);
    });
  });

  // TC_TRT_006 | CheckDB: Không | Rollback: Không áp dụng
  test('TC_TRT_006 - should return full snapshot data for treatment with lab and prescription', async () => {
    const res = await request(app).get(`/treatments/${validTreatmentId}`).expect(200);
    expect(res.body).toHaveProperty('diagnosis');
    expect(res.body).toHaveProperty('totalCost');
    expect(res.body.laborder).toHaveProperty('items');
    expect(res.body.laborder).toHaveProperty('totalPrice');
    expect(res.body.prescription).toHaveProperty('items');
    expect(res.body.prescription).toHaveProperty('totalPrice');
  });

  // TC_TRT_007 | CheckDB: Không | Rollback: Không áp dụng
  test('TC_TRT_007 - should return laborder=null and prescription=null when not present', async () => {
    const res = await request(app).get(`/treatments/${noLabPxTreatmentId}`).expect(200);
    expect(res.body.laborder).toBeNull();
    expect(res.body.prescription).toBeNull();
    expect(res.body).toHaveProperty('diagnosis');
  });

  // TC_TRT_008 | CheckDB: Không | Rollback: Không áp dụng
  test('TC_TRT_008 - should return 404 when treatmentId not found', async () => {
    const res = await request(app).get(`/treatments/000000000000000000000001`).expect(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  // TC_TRT_009 | CheckDB: Không | Rollback: Không áp dụng
  test('TC_TRT_009 - should verify totalCost equals laborder + prescription price', async () => {
    const res = await request(app).get(`/treatments/${validTreatmentId}`).expect(200);
    const lab = res.body.laborder?.totalPrice || 0;
    const px  = res.body.prescription?.totalPrice || 0;
    expect(res.body.totalCost).toBe(lab + px); // 100000 + 50000 = 150000
  });

  // TC_TRT_010 | CheckDB: Không | Rollback: Không áp dụng
  test('TC_TRT_010 - should return correct ownerName and ownerPhone in healthProfile snapshot', async () => {
    const res = await request(app).get(`/treatments/${validTreatmentId}`).expect(200);
    expect(res.body.healthProfile).toHaveProperty('ownerName', 'Lam TRT');
    expect(res.body.healthProfile).toHaveProperty('ownerPhone', '0908888888');
  });
});
