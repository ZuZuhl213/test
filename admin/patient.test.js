require("dotenv").config();

const mongoose = require("mongoose");
const request = require("supertest");
const express = require("express");
const { MongoMemoryServer } = require("mongodb-memory-server");

const database = require("../config/database");
const patientRoutes = require("../src/routes/patientRoutes");
const Patient = require("../src/models/patient");
const Account = require("../src/models/account");
const Role = require("../src/models/role");

const app = express();
app.use(express.json());
app.use("/api/patients", patientRoutes);

describe("Patient Management - Unit Tests", () => {
  jest.setTimeout(30000);

  let mongoServer;
  let testDataCounter = 0;
  let patientRole;

  // Tạo hậu tố duy nhất để dữ liệu test không bị trùng giữa các lần chạy.
  function generateUniqueSuffix() {
    testDataCounter += 1;
    return `${Date.now()}-${testDataCounter}`;
  }

  // Tạo payload bệnh nhân giả lập theo đúng input của API.
  function buildMockPatientData(overrides = {}) {
    const uniqueSuffix = generateUniqueSuffix();

    return {
      name: `QA Patient ${uniqueSuffix}`,
      email: `qa-patient-${uniqueSuffix}@example.com`,
      phone: `0901${String(uniqueSuffix).replace(/[^0-9]/g, "").slice(-8) || "00000000"}`,
      password: "Password123!",
      dob: "1995-01-01",
      address: "District 1, Ho Chi Minh City",
      gender: "other",
      ...overrides,
    };
  }

  // Xóa sạch dữ liệu test của module Patient để DB luôn quay về trạng thái ban đầu.
  async function cleanupMockData() {
    await Patient.deleteMany({});
    await Account.deleteMany({ email: /^qa-patient-/i });
  }

  // Gọi API tạo patient và trả về response cùng payload đã dùng.
  async function createPatientThroughApi(overrides = {}) {
    const mockPatientData = buildMockPatientData(overrides);
    const createResponse = await request(app).post("/api/patients").send(mockPatientData);
    return { mockPatientData, createResponse };
  }

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongoServer.getUri();

    await database.connect();

    patientRole = await Role.findOne({ name: "patient" });
    if (!patientRole) {
      patientRole = await Role.create({
        name: "patient",
        description: "Patient role",
      });
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
    await Role.deleteMany({ name: "patient" });

    await database.disconnect();

    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  // ID: TC_QLTK_014 - Mục tiêu: Tạo Patient thành công - Kịch bản: Standard
  it("TC_QLTK_014 - should create a patient successfully", async () => {
    const mockPatientData = buildMockPatientData();

    const createResponse = await request(app).post("/api/patients").send(mockPatientData);

    // Controller hiện trả 201 khi tạo thành công; test chấp nhận 200/201 để khớp source.
    expect([200, 201]).toContain(createResponse.status);
    expect(createResponse.body).toHaveProperty("data");

    const createdPatientId = createResponse.body.data._id;
    const createdPatientInDb = await Patient.findById(createdPatientId).lean();
    expect(createdPatientInDb).not.toBeNull();
    expect(createdPatientInDb.name).toBe(mockPatientData.name);
    expect(createdPatientInDb.phone).toBe(mockPatientData.phone);

    const createdAccountInDb = await Account.findOne({ email: mockPatientData.email }).lean();
    expect(createdAccountInDb).not.toBeNull();
    expect(createdPatientInDb.accountId.toString()).toBe(createdAccountInDb._id.toString());
  });

  // ID: TC_QLTK_015 - Mục tiêu: Lấy danh sách Patient thành công - Kịch bản: Standard
  it("TC_QLTK_015 - should get patient list successfully", async () => {
    const { createResponse, mockPatientData } = await createPatientThroughApi();

    expect([200, 201]).toContain(createResponse.status);
    expect(createResponse.body).toHaveProperty("data");

    const listResponse = await request(app).get("/api/patients");

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toHaveProperty("data");
    expect(Array.isArray(listResponse.body.data)).toBe(true);

    const createdPatientId = String(createResponse.body.data._id);
    const listedPatientIds = listResponse.body.data.map((patientItem) => String(patientItem._id));
    expect(listedPatientIds).toContain(createdPatientId);

    const createdPatientInDb = await Patient.findById(createdPatientId).lean();
    expect(createdPatientInDb).not.toBeNull();
    expect(createdPatientInDb.name).toBe(mockPatientData.name);
  });

  // ID: TC_QLTK_016 - Mục tiêu: Lấy Patient theo ID thành công - Kịch bản: Standard
  it("TC_QLTK_016 - should get patient by ID successfully", async () => {
    const { createResponse, mockPatientData } = await createPatientThroughApi();

    expect([200, 201]).toContain(createResponse.status);
    expect(createResponse.body).toHaveProperty("data");

    const createdPatientId = createResponse.body.data._id;
    const getResponse = await request(app).get(`/api/patients/${createdPatientId}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toHaveProperty("data");
    expect(getResponse.body.data).toHaveProperty("_id", createdPatientId);
    expect(getResponse.body.data).toHaveProperty("name", mockPatientData.name);

    const patientInDb = await Patient.findById(createdPatientId).lean();
    expect(patientInDb).not.toBeNull();
    expect(patientInDb.email).toBeUndefined();
  });

  // ID: TC_QLTK_017 - Mục tiêu: Cập nhật Patient theo ID thành công - Kịch bản: Standard
  it("TC_QLTK_017 - should update patient successfully by ID", async () => {
    const { createResponse } = await createPatientThroughApi();

    expect([200, 201]).toContain(createResponse.status);
    expect(createResponse.body).toHaveProperty("data");

    const createdPatientId = createResponse.body.data._id;
    const updatedPhone = "0987654321";

    const updateResponse = await request(app)
      .put(`/api/patients/${createdPatientId}`)
      .send({ phone: updatedPhone });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toHaveProperty("phone", updatedPhone);

    const updatedPatientInDb = await Patient.findById(createdPatientId).lean();
    expect(updatedPatientInDb).not.toBeNull();
    expect(updatedPatientInDb.phone).toBe(updatedPhone);
  });

  // ID: TC_QLTK_018 - Mục tiêu: Xóa Patient theo ID thành công - Kịch bản: Standard
  it("TC_QLTK_018 - should delete patient successfully by ID", async () => {
    const { createResponse } = await createPatientThroughApi();

    expect([200, 201]).toContain(createResponse.status);
    expect(createResponse.body).toHaveProperty("data");

    const createdPatientId = createResponse.body.data._id;
    const patientBeforeDelete = await Patient.findById(createdPatientId).lean();
    expect(patientBeforeDelete).not.toBeNull();

    const deleteResponse = await request(app).delete(`/api/patients/${createdPatientId}`);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toHaveProperty("message", "Xóa (soft) bệnh nhân thành công");

    const deletedPatientInDb = await Patient.findById(createdPatientId).lean();
    expect(deletedPatientInDb).not.toBeNull();
    expect(deletedPatientInDb.deleted).toBe(true);
    expect(deletedPatientInDb.status).toBe("inactive");
  });

  // ID: TC_QLTK_019 - Mục tiêu: Tạo Patient thất bại do thiếu trường bắt buộc - Kịch bản: Exception
  it("TC_QLTK_019 - should fail to create patient when required fields are missing", async () => {
    const incompletePatientData = {
      name: "Incomplete QA Patient",
      email: "incomplete-qa-patient@example.com",
    };

    const createResponse = await request(app).post("/api/patients").send(incompletePatientData);

    expect(createResponse.status).toBe(400);
    expect(createResponse.body).toHaveProperty(
      "message",
      "Thiếu thông tin bắt buộc: name, email, password, phone"
    );

    const patientCountInDb = await Patient.countDocuments({ name: incompletePatientData.name });
    const accountCountInDb = await Account.countDocuments({ email: incompletePatientData.email });
    expect(patientCountInDb).toBe(0);
    expect(accountCountInDb).toBe(0);
  });

  // ID: TC_QLTK_020 - Mục tiêu: Lấy Patient không tìm thấy - Kịch bản: Exception
  it("TC_QLTK_020 - should return error when patient ID is invalid", async () => {
    const invalidPatientId = "invalid-patient-id";
    expect(mongoose.Types.ObjectId.isValid(invalidPatientId)).toBe(false);

    const getResponse = await request(app).get(`/api/patients/${invalidPatientId}`);

    expect(getResponse.status).toBe(400);
    expect(getResponse.body).toHaveProperty("message", "Id không hợp lệ");

    const patientCountInDb = await Patient.countDocuments({});
    expect(patientCountInDb).toBe(0);
  });
});