require("dotenv").config();

const mongoose = require("mongoose");
const request = require("supertest");
const express = require("express");
const { MongoMemoryServer } = require("mongodb-memory-server");

const database = require("../config/database");
const receptionistRoutes = require("../src/routes/receptionistRoutes");
const Receptionist = require("../src/models/receptionist");
const Account = require("../src/models/account");
const Role = require("../src/models/role");

// Tạo app Express dùng riêng cho unit test để không phụ thuộc vào server thật.
const app = express();
app.use(express.json());
app.use("/api/receptionists", receptionistRoutes);

describe("Receptionist Management - Unit Tests", () => {
  jest.setTimeout(30000);

  let mongoServer;
  let testDataCounter = 0;
  let receptionistRole;

  // Tạo hậu tố duy nhất để dữ liệu test không bị trùng giữa các lần chạy.
  function generateUniqueSuffix() {
    testDataCounter += 1;
    return `${Date.now()}-${testDataCounter}`;
  }

  // Tạo payload receptionist giả lập theo đúng input của API.
  function buildMockReceptionistData(overrides = {}) {
    const uniqueSuffix = generateUniqueSuffix();

    return {
      name: `QA Receptionist ${uniqueSuffix}`,
      email: `qa-receptionist-${uniqueSuffix}@example.com`,
      phone: `0902${String(uniqueSuffix).replace(/[^0-9]/g, "").slice(-8) || "00000000"}`,
      password: "Password123!",
      ...overrides,
    };
  }

  // Xóa dữ liệu test của module Receptionist để DB luôn quay về trạng thái sạch.
  async function cleanupMockData() {
    await Receptionist.deleteMany({});
    await Account.deleteMany({ email: /^qa-receptionist-/i });
  }

  // Gọi API tạo receptionist và trả về response cùng payload đã dùng.
  async function createReceptionistThroughApi(overrides = {}) {
    const mockReceptionistData = buildMockReceptionistData(overrides);
    const createResponse = await request(app).post("/api/receptionists").send(mockReceptionistData);
    return { mockReceptionistData, createResponse };
  }

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongoServer.getUri();

    await database.connect();

    receptionistRole = await Role.findOne({ name: "receptionist" });
    if (!receptionistRole) {
      receptionistRole = await Role.create({
        name: "receptionist",
        description: "Receptionist role",
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
    await Role.deleteMany({ name: "receptionist" });

    await database.disconnect();

    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  // ID: TC_QLTK_021 - Mục tiêu: Tạo Receptionist thành công - Kịch bản: Standard
  it("TC_QLTK_021 - should create a receptionist successfully", async () => {
    const mockReceptionistData = buildMockReceptionistData();

    const createResponse = await request(app).post("/api/receptionists").send(mockReceptionistData);

    // Controller hiện trả 201 khi tạo thành công; test chấp nhận 200/201 để khớp source.
    expect([200, 201]).toContain(createResponse.status);
    expect(createResponse.body).toHaveProperty("data");

    const createdReceptionistId = createResponse.body.data._id;
    const createdReceptionistInDb = await Receptionist.findById(createdReceptionistId).lean();
    expect(createdReceptionistInDb).not.toBeNull();
    expect(createdReceptionistInDb.name).toBe(mockReceptionistData.name);
    expect(createdReceptionistInDb.phone).toBe(mockReceptionistData.phone);

    // CheckDB: xác nhận account liên kết đã được tạo đúng theo email.
    const createdAccountInDb = await Account.findOne({ email: mockReceptionistData.email }).lean();
    expect(createdAccountInDb).not.toBeNull();
    expect(String(createdReceptionistInDb.accountId)).toBe(String(createdAccountInDb._id));
  });

  // ID: TC_QLTK_022 - Mục tiêu: Lấy danh sách Receptionist thành công - Kịch bản: Standard
  it("TC_QLTK_022 - should get receptionist list successfully", async () => {
    const { createResponse, mockReceptionistData } = await createReceptionistThroughApi();

    expect([200, 201]).toContain(createResponse.status);
    expect(createResponse.body).toHaveProperty("data");

    const listResponse = await request(app).get("/api/receptionists");

    expect(listResponse.status).toBe(200);
    expect(Array.isArray(listResponse.body)).toBe(true);

    const createdReceptionistId = String(createResponse.body.data._id);
    const listedReceptionistIds = listResponse.body.map((receptionistItem) => String(receptionistItem._id));
    expect(listedReceptionistIds).toContain(createdReceptionistId);

    // CheckDB: xác nhận receptionist đã thực sự tồn tại trong DB trước khi kiểm tra danh sách.
    const createdReceptionistInDb = await Receptionist.findById(createdReceptionistId).lean();
    expect(createdReceptionistInDb).not.toBeNull();
    expect(createdReceptionistInDb.name).toBe(mockReceptionistData.name);
  });

  // ID: TC_QLTK_023 - Mục tiêu: Lấy Receptionist theo ID thành công - Kịch bản: Standard
  it("TC_QLTK_023 - should get receptionist by ID successfully", async () => {
    const { createResponse, mockReceptionistData } = await createReceptionistThroughApi();

    expect([200, 201]).toContain(createResponse.status);
    expect(createResponse.body).toHaveProperty("data");

    const createdReceptionistId = createResponse.body.data._id;
    const getResponse = await request(app).get(`/api/receptionists/${createdReceptionistId}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toHaveProperty("_id", createdReceptionistId);
    expect(getResponse.body).toHaveProperty("name", mockReceptionistData.name);

    // CheckDB: xác nhận bản ghi vẫn còn trong DB và không bị thay đổi sau thao tác đọc.
    const receptionistInDb = await Receptionist.findById(createdReceptionistId).lean();
    expect(receptionistInDb).not.toBeNull();
    expect(receptionistInDb.phone).toBe(mockReceptionistData.phone);
  });

  // ID: TC_QLTK_024 - Mục tiêu: Cập nhật Receptionist theo ID thành công - Kịch bản: Standard
  it("TC_QLTK_024 - should update receptionist successfully by ID", async () => {
    const { createResponse } = await createReceptionistThroughApi();

    expect([200, 201]).toContain(createResponse.status);
    expect(createResponse.body).toHaveProperty("data");

    const createdReceptionistId = createResponse.body.data._id;
    const updatedPhone = "0987654321";

    const updateResponse = await request(app)
      .put(`/api/receptionists/${createdReceptionistId}`)
      .send({ phone: updatedPhone });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toHaveProperty("phone", updatedPhone);

    // CheckDB: xác nhận số điện thoại đã được cập nhật trong MongoDB.
    const updatedReceptionistInDb = await Receptionist.findById(createdReceptionistId).lean();
    expect(updatedReceptionistInDb).not.toBeNull();
    expect(updatedReceptionistInDb.phone).toBe(updatedPhone);
  });

  // ID: TC_QLTK_025 - Mục tiêu: Xóa Receptionist theo ID thành công - Kịch bản: Standard
  it("TC_QLTK_025 - should delete receptionist successfully by ID", async () => {
    const { createResponse, mockReceptionistData } = await createReceptionistThroughApi();

    expect([200, 201]).toContain(createResponse.status);
    expect(createResponse.body).toHaveProperty("data");

    const createdReceptionistId = createResponse.body.data._id;
    const receptionistBeforeDelete = await Receptionist.findById(createdReceptionistId).lean();
    expect(receptionistBeforeDelete).not.toBeNull();

    const linkedAccountId = receptionistBeforeDelete.accountId;
    const deleteResponse = await request(app).delete(`/api/receptionists/${createdReceptionistId}`);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toHaveProperty("message", "Receptionist deleted successfully");

    // CheckDB: xác nhận Receptionist đã bị xóa khỏi MongoDB.
    const deletedReceptionistInDb = await Receptionist.findById(createdReceptionistId).lean();
    expect(deletedReceptionistInDb).toBeNull();

    // CheckDB: xác nhận Account liên kết cũng đã bị xóa theo logic controller.
    const deletedAccountInDb = await Account.findById(linkedAccountId).lean();
    expect(deletedAccountInDb).toBeNull();

    // Kiểm tra bổ sung rằng email đã tạo không còn tồn tại trong Account collection.
    const accountByEmail = await Account.findOne({ email: mockReceptionistData.email }).lean();
    expect(accountByEmail).toBeNull();
  });
});
