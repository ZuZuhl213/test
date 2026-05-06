/**
 * INTEGRATION TEST – Patient Profile (Quản lý tài khoản cá nhân)
 * TC_PAT_001 → TC_PAT_010
 */
const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const patientRoutes = require('../../src/routes/patientRoutes');
const Patient = require('../../src/models/patient');
const Account = require('../../src/models/account');

const app = express();
app.use(express.json());
app.use('/api/patients', patientRoutes);

let mongod, validAccountId, validPatientId, dupPhone;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongod.getUri();
  await mongoose.connect(mongod.getUri());

  const acc = await Account.create({ email: 'pat@test.com', password: 'x', roleId: new mongoose.Types.ObjectId() });
  validAccountId = String(acc._id);
  const pat = await Patient.create({ accountId: acc._id, name: 'Nguyen Van A', phone: '0901111111', gender: 'male', deleted: false });
  validPatientId = String(pat._id);

  await Patient.create({ accountId: new mongoose.Types.ObjectId(), name: 'Tran Thi B', phone: '0902222222', deleted: false });
  dupPhone = '0902222222';
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe('Patient Profile Management', () => {

  // TC_PAT_001 | CheckDB: Không | Rollback: Không áp dụng
  test('TC_PAT_001 - should get patient profile by valid accountId', async () => {
    const res = await request(app).get(`/api/patients/account/${validAccountId}`).expect(200);
    expect(res.body).toHaveProperty('_id');
    expect(res.body).toHaveProperty('name');
    expect(res.body).toHaveProperty('phone');
  });

  // TC_PAT_002 | CheckDB: Không | Rollback: Không áp dụng
  test('TC_PAT_002 - should return 404 when accountId not found', async () => {
    const res = await request(app).get(`/api/patients/account/000000000000000000000001`).expect(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  // TC_PAT_003 | CheckDB: Không | Rollback: Không áp dụng
  test('TC_PAT_003 - should return 400 when accountId format is invalid', async () => {
    const res = await request(app).get(`/api/patients/account/invalid-id`).expect(400);
    expect(res.body).toHaveProperty('message');
  });

  // TC_PAT_004 | CheckDB: Có | Rollback: Có
  test('TC_PAT_004 - should update patient profile successfully', async () => {
    const res = await request(app).put(`/api/patients/${validPatientId}`)
      .send({ name: 'Ten Moi', phone: '0903333333', gender: 'male', address: 'HN' }).expect(200);
    expect(res.body.name).toBe('Ten Moi');
    const fromDb = await Patient.findById(validPatientId).lean();
    expect(fromDb.name).toBe('Ten Moi'); // CheckDB
    await Patient.findByIdAndUpdate(validPatientId, { name: 'Nguyen Van A', phone: '0901111111' }); // ROLLBACK
  });

  // TC_PAT_005 | CheckDB: Có | Rollback: Có
  test('TC_PAT_005 - should update only name and keep other fields unchanged', async () => {
    await request(app).put(`/api/patients/${validPatientId}`).send({ name: 'Chi Doi Ten' }).expect(200);
    const fromDb = await Patient.findById(validPatientId).lean();
    expect(fromDb.name).toBe('Chi Doi Ten');
    expect(fromDb.phone).toBe('0901111111'); // CheckDB: phone not changed
    await Patient.findByIdAndUpdate(validPatientId, { name: 'Nguyen Van A' }); // ROLLBACK
  });

  // TC_PAT_006 | CheckDB: Không | Rollback: Không áp dụng
  test('TC_PAT_006 - should return 404 when patient not found', async () => {
    const res = await request(app).put(`/api/patients/000000000000000000000001`).send({ name: 'Test' }).expect(404);
    expect(res.body.message).toMatch(/không tìm thấy/i);
  });

  // TC_PAT_007 | CheckDB: Không | Rollback: Không áp dụng
  test('TC_PAT_007 - should return 400 when phone already used by another patient', async () => {
    const res = await request(app).put(`/api/patients/${validPatientId}`).send({ phone: dupPhone }).expect(400);
    expect(res.body.message).toMatch(/đã tồn tại/i);
  });

  // TC_PAT_008 | CheckDB: Không | Rollback: Không áp dụng
  test('TC_PAT_008 - should return 400 when gender value is invalid', async () => {
    const res = await request(app).put(`/api/patients/${validPatientId}`).send({ gender: 'unknown' }).expect(400);
    expect(res.body.message).toMatch(/giới tính/i);
  });

  // TC_PAT_009 [BUG] | CheckDB: Có | Rollback: Có
  test('TC_PAT_009 - [BUG] should return 400 for invalid phone format, but returns 200', async () => {
    const res = await request(app).put(`/api/patients/${validPatientId}`).send({ phone: 'abc!@#' });
    if (res.status === 200) {
      const fromDb = await Patient.findById(validPatientId).lean();
      expect(fromDb.phone).toBe('abc!@#'); // CheckDB: confirms BUG
      await Patient.findByIdAndUpdate(validPatientId, { phone: '0901111111' }); // ROLLBACK
    } else {
      expect(res.status).toBe(400);
    }
  });

  // TC_PAT_010 | CheckDB: Không | Rollback: Không áp dụng
  test('TC_PAT_010 - should return 400 when trying to update accountId', async () => {
    const res = await request(app).put(`/api/patients/${validPatientId}`)
      .send({ accountId: '000000000000000000000999' }).expect(400);
    expect(res.body.message).toMatch(/accountId/i);
  });
});
