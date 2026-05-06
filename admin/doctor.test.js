require("dotenv").config();

const mongoose = require("mongoose");
const request = require("supertest");
const express = require("express");
const { MongoMemoryServer } = require("mongodb-memory-server");

const database = require("../config/database");
const doctorRoutes = require("../src/routes/doctorRoutes");
const Doctor = require("../src/models/doctor");
const Account = require("../src/models/account");
const Role = require("../src/models/role");
const Specialty = require("../src/models/specialty");

const app = express();
app.use(express.json());
app.use("/api/doctors", doctorRoutes);

describe("Doctor Account Management - Unit Tests", () => {
  jest.setTimeout(30000);

  let mongoServer;
  let dentistrySpecialty;
  let testDataCounter = 0;

  function generateUniqueSuffix() {
    testDataCounter += 1;
    return `${Date.now()}-${testDataCounter}`;
  }

  function buildMockDoctorData(overrides = {}) {
    const uniqueSuffix = generateUniqueSuffix();

    return {
      name: `QA Doctor ${uniqueSuffix}`,
      specialtyName: dentistrySpecialty?.name || "Dentistry",
      phone: `0900${String(uniqueSuffix).replace(/[^0-9]/g, "").slice(-8) || "00000000"}`,
      email: `qa-doctor-${uniqueSuffix}@example.com`,
      password: "Password123!",
      experience: 5,
      ...overrides,
    };
  }

  async function cleanupMockData() {
    await Doctor.deleteMany({ name: /^QA Doctor/i });
    await Account.deleteMany({ email: /^qa-doctor-/i });
  }

  async function createDoctorThroughApi(overrides = {}) {
    const mockDoctorData = buildMockDoctorData(overrides);
    const createResponse = await request(app).post("/api/doctors").send(mockDoctorData);
    return { mockDoctorData, createResponse };
  }

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongoServer.getUri();

    await database.connect();

    const existingDoctorRole = await Role.findOne({ name: "doctor" });
    if (!existingDoctorRole) {
      await Role.create({ name: "doctor", description: "Doctor role" });
    }

    dentistrySpecialty = await Specialty.findOne({ name: "Dentistry" });
    if (!dentistrySpecialty) {
      dentistrySpecialty = await Specialty.create({ name: "Dentistry" });
    }
  });

  beforeEach(async () => {
    await cleanupMockData();
  });

  afterEach(async () => {
    await cleanupMockData();
  });

  afterAll(async () => {
    await cleanupMockData();
    await Specialty.deleteMany({ name: "Dentistry" });
    await Role.deleteMany({ name: "doctor" });

    await database.disconnect();

    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  // ID: TC_QLTK_001 - Mục tiêu: Tạo bác sĩ thành công - Kịch bản: Standard
  it("TC_QLTK_001 - should create a doctor successfully", async () => {
    const mockDoctorData = buildMockDoctorData();

    const createResponse = await request(app).post("/api/doctors").send(mockDoctorData);

    expect([200, 201]).toContain(createResponse.status);
    expect(createResponse.body).toHaveProperty("data");

    const createdDoctorId = createResponse.body.data._id;
    const createdDoctorInDb = await Doctor.findById(createdDoctorId).lean();
    expect(createdDoctorInDb).not.toBeNull();
    expect(createdDoctorInDb.name).toBe(mockDoctorData.name);
    expect(String(createdDoctorInDb.specialtyId)).toBe(String(dentistrySpecialty._id));

    const createdAccountInDb = await Account.findOne({ email: mockDoctorData.email }).lean();
    expect(createdAccountInDb).not.toBeNull();
    expect(String(createdDoctorInDb.accountId)).toBe(String(createdAccountInDb._id));
  });

  // ID: TC_QLTK_002 - Mục tiêu: Tạo bác sĩ thất bại do email đã được đăng ký - Kịch bản: Exception
  it("TC_QLTK_002 - should reject doctor creation when email already exists", async () => {
    const mockDoctorData = buildMockDoctorData();

    const firstCreateResponse = await request(app).post("/api/doctors").send(mockDoctorData);
    expect([200, 201]).toContain(firstCreateResponse.status);
    expect(firstCreateResponse.body).toHaveProperty("data");

    const duplicateCreateResponse = await request(app).post("/api/doctors").send({
      ...buildMockDoctorData(),
      name: `${mockDoctorData.name} Duplicate`,
      email: mockDoctorData.email,
    });

    expect(duplicateCreateResponse.status).toBe(400);
    expect(duplicateCreateResponse.body).toHaveProperty("message", "Email đã được sử dụng");

    const duplicatedAccountCount = await Account.countDocuments({ email: mockDoctorData.email });
    expect(duplicatedAccountCount).toBe(1);
  });

  // ID: TC_QLTK_003 - Mục tiêu: Lấy danh sách bác sĩ thành công - Kịch bản: Standard
  it("TC_QLTK_003 - should retrieve doctor list successfully", async () => {
    const { createResponse, mockDoctorData } = await createDoctorThroughApi();

    expect([200, 201]).toContain(createResponse.status);
    expect(createResponse.body).toHaveProperty("data");

    const listResponse = await request(app).get("/api/doctors");

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toHaveProperty("data");
    expect(Array.isArray(listResponse.body.data)).toBe(true);

    const createdDoctorId = String(createResponse.body.data._id);
    const listedDoctorIds = listResponse.body.data.map((doctorItem) => String(doctorItem._id));
    expect(listedDoctorIds).toContain(createdDoctorId);

    const createdDoctorInDb = await Doctor.findById(createdDoctorId).lean();
    expect(createdDoctorInDb).not.toBeNull();
    expect(createdDoctorInDb.name).toBe(mockDoctorData.name);
  });

  // ID: TC_QLTK_004 - Mục tiêu: Lấy thông tin bác sĩ theo ID hợp lệ - Kịch bản: Standard
  it("TC_QLTK_004 - should retrieve doctor information by valid ID successfully", async () => {
    const { createResponse, mockDoctorData } = await createDoctorThroughApi();

    expect([200, 201]).toContain(createResponse.status);
    expect(createResponse.body).toHaveProperty("data");

    const createdDoctorId = createResponse.body.data._id;
    const getResponse = await request(app).get(`/api/doctors/${createdDoctorId}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toHaveProperty("data");
    expect(getResponse.body.data).toHaveProperty("doctor");
    expect(String(getResponse.body.data.doctor._id)).toBe(String(createdDoctorId));

    const doctorInDb = await Doctor.findById(createdDoctorId).lean();
    expect(doctorInDb).not.toBeNull();
    expect(doctorInDb.name).toBe(mockDoctorData.name);
  });

  // ID: TC_QLTK_005 - Mục tiêu: Cập nhật thông tin bác sĩ theo ID - Kịch bản: Standard
  it("TC_QLTK_005 - should update doctor experience by ID successfully", async () => {
    const { createResponse } = await createDoctorThroughApi();

    expect([200, 201]).toContain(createResponse.status);
    expect(createResponse.body).toHaveProperty("data");

    const createdDoctorId = createResponse.body.data._id;
    const updatePayload = { experience: 10 };

    const updateResponse = await request(app)
      .put(`/api/doctors/${createdDoctorId}`)
      .send(updatePayload);

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toHaveProperty("data");
    expect(updateResponse.body.data).toHaveProperty("experience", 10);

    const updatedDoctorInDb = await Doctor.findById(createdDoctorId).lean();
    expect(updatedDoctorInDb).not.toBeNull();
    expect(updatedDoctorInDb.experience).toBe(10);
  });

  // ID: TC_QLTK_005 - Mục tiêu: Cập nhật bác sĩ thất bại khi ID không tồn tại - Kịch bản: Exception
  it("TC_QLTK_005 - should return 404 when updating a doctor with a non-existent ID", async () => {
    const nonExistentDoctorId = new mongoose.Types.ObjectId().toString();

    const updateResponse = await request(app)
      .put(`/api/doctors/${nonExistentDoctorId}`)
      .send({ experience: 10 });

    expect(updateResponse.status).toBe(404);
    expect(updateResponse.body).toHaveProperty("message", "Không tìm thấy bác sĩ");

    const doctorInDb = await Doctor.findById(nonExistentDoctorId).lean();
    expect(doctorInDb).toBeNull();
  });

  // ID: TC_QLTK_006 - Mục tiêu: Xóa bác sĩ theo ID thành công - Kịch bản: Standard
  it("TC_QLTK_006 - should delete doctor successfully by ID", async () => {
    const { createResponse } = await createDoctorThroughApi();

    expect([200, 201]).toContain(createResponse.status);
    expect(createResponse.body).toHaveProperty("data");

    const createdDoctorId = createResponse.body.data._id;
    const doctorInDbBeforeDelete = await Doctor.findById(createdDoctorId).lean();
    expect(doctorInDbBeforeDelete).not.toBeNull();

    const linkedAccountId = doctorInDbBeforeDelete.accountId;

    const deleteResponse = await request(app).delete(`/api/doctors/${createdDoctorId}`);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toHaveProperty(
      "message",
      "Xóa bác sĩ và dữ liệu liên quan thành công"
    );

    const deletedDoctorInDb = await Doctor.findById(createdDoctorId).lean();
    expect(deletedDoctorInDb).toBeNull();

    const deletedAccountInDb = await Account.findById(linkedAccountId).lean();
    expect(deletedAccountInDb).toBeNull();
  });
});
