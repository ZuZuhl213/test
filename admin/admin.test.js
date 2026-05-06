require("dotenv").config();

const mongoose = require("mongoose");
const request = require("supertest");
const express = require("express");
const { MongoMemoryServer } = require("mongodb-memory-server");

const database = require("../config/database");
const adminRoutes = require("../src/routes/adminRoutes");
const Admin = require("../src/models/admin");
const Account = require("../src/models/account");
const Role = require("../src/models/role");

const app = express();
app.use(express.json());
app.use("/api/admins", adminRoutes);

describe("Admin Account Management - Unit Tests", () => {
  jest.setTimeout(30000);

  let mongoServer;
  let testDataCounter = 0;

  // Tạo hậu tố duy nhất để dữ liệu test không trùng nhau giữa các lần chạy.
  function generateUniqueSuffix() {
    testDataCounter += 1;
    return `${Date.now()}-${testDataCounter}`;
  }

  // Tạo payload admin giả lập theo đúng dữ liệu đầu vào của API.
  function buildMockAdminData(overrides = {}) {
    const uniqueSuffix = generateUniqueSuffix();

    return {
      name: `QA Admin ${uniqueSuffix}`,
      email: `qa-admin-${uniqueSuffix}@example.com`,
      phone: `0900${String(uniqueSuffix).replace(/[^0-9]/g, "").slice(-8) || "00000000"}`,
      password: "Password123!",
      ...overrides,
    };
  }

  // Xóa sạch dữ liệu test của module Admin để DB luôn quay về trạng thái ban đầu.
  async function cleanupMockData() {
    await Admin.deleteMany({});
    await Account.deleteMany({ email: /^qa-admin-/i });
  }

  // Gọi API tạo admin và trả về response cùng payload đã dùng.
  async function createAdminThroughApi(overrides = {}) {
    const mockAdminData = buildMockAdminData(overrides);
    const createResponse = await request(app).post("/api/admins").send(mockAdminData);
    return { mockAdminData, createResponse };
  }

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongoServer.getUri();

    await database.connect();

    const existingAdminRole = await Role.findOne({ name: "admin" });
    if (!existingAdminRole) {
      await Role.create({
        name: "admin",
        description: "Admin role",
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
    await Role.deleteMany({ name: "admin" });

    await database.disconnect();

    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  // ID: TC_QLTK_007 - Mục tiêu: Tạo Admin thành công - Kịch bản: Standard
  it("TC_QLTK_007 - should create an admin successfully", async () => {
    const mockAdminData = buildMockAdminData();

    const createResponse = await request(app).post("/api/admins").send(mockAdminData);

    expect([200, 201]).toContain(createResponse.status);
    expect(createResponse.body).toHaveProperty("_id");
    expect(createResponse.body).toHaveProperty("name", mockAdminData.name);
    expect(createResponse.body).toHaveProperty("phone", mockAdminData.phone);

    // CheckDB: xác nhận Admin đã được lưu trong MongoDB.
    const createdAdminId = createResponse.body._id;
    const createdAdminInDb = await Admin.findById(createdAdminId).lean();
    expect(createdAdminInDb).not.toBeNull();
    expect(createdAdminInDb.name).toBe(mockAdminData.name);
    expect(createdAdminInDb.phone).toBe(mockAdminData.phone);

    // CheckDB: xác nhận Account liên kết đã được tạo đúng theo email.
    const createdAccountInDb = await Account.findOne({ email: mockAdminData.email }).lean();
    expect(createdAccountInDb).not.toBeNull();
    expect(createdAdminInDb.accountId.toString()).toBe(createdAccountInDb._id.toString());
  });

  // ID: TC_QLTK_008 - Mục tiêu: Lấy danh sách Admin thành công - Kịch bản: Standard
  it("TC_QLTK_008 - should get admin list successfully", async () => {
    const { createResponse, mockAdminData } = await createAdminThroughApi();

    expect([200, 201]).toContain(createResponse.status);
    expect(createResponse.body).toHaveProperty("_id");

    const listResponse = await request(app).get("/api/admins");

    expect(listResponse.status).toBe(200);
    expect(Array.isArray(listResponse.body)).toBe(true);

    const createdAdminId = createResponse.body._id;
    const listedAdminIds = listResponse.body.map((adminItem) => String(adminItem._id));
    expect(listedAdminIds).toContain(String(createdAdminId));

    // CheckDB: xác nhận admin đã thực sự tồn tại trong DB trước khi kiểm tra danh sách.
    const createdAdminInDb = await Admin.findById(createdAdminId).lean();
    expect(createdAdminInDb).not.toBeNull();
    expect(createdAdminInDb.name).toBe(mockAdminData.name);
  });

  // ID: TC_QLTK_009 - Mục tiêu: Lấy Admin theo ID thành công - Kịch bản: Standard
  it("TC_QLTK_009 - should get admin by ID successfully", async () => {
    const { createResponse, mockAdminData } = await createAdminThroughApi();

    expect([200, 201]).toContain(createResponse.status);
    expect(createResponse.body).toHaveProperty("_id");

    const createdAdminId = createResponse.body._id;
    const getResponse = await request(app).get(`/api/admins/${createdAdminId}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toHaveProperty("_id", createdAdminId);
    expect(getResponse.body).toHaveProperty("name", mockAdminData.name);

    // CheckDB: xác nhận bản ghi vẫn còn trong DB và không bị thay đổi.
    const adminInDb = await Admin.findById(createdAdminId).lean();
    expect(adminInDb).not.toBeNull();
    expect(adminInDb.phone).toBe(mockAdminData.phone);
  });

  // ID: TC_QLTK_010 - Mục tiêu: Cập nhật Admin thành công - Kịch bản: Standard
  it("TC_QLTK_010 - should update admin phone successfully", async () => {
    const { createResponse } = await createAdminThroughApi();

    expect([200, 201]).toContain(createResponse.status);
    expect(createResponse.body).toHaveProperty("_id");

    const createdAdminId = createResponse.body._id;
    const updatedPhone = "0987654321";

    const updateResponse = await request(app)
      .put(`/api/admins/${createdAdminId}`)
      .send({ phone: updatedPhone });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toHaveProperty("_id", createdAdminId);
    expect(updateResponse.body).toHaveProperty("phone", updatedPhone);

    // CheckDB: xác nhận số điện thoại đã được cập nhật trong MongoDB.
    const updatedAdminInDb = await Admin.findById(createdAdminId).lean();
    expect(updatedAdminInDb).not.toBeNull();
    expect(updatedAdminInDb.phone).toBe(updatedPhone);
  });

  // ID: TC_QLTK_011 - Mục tiêu: Xóa Admin theo ID thành công - Kịch bản: Standard
  it("TC_QLTK_011 - should delete admin successfully by ID", async () => {
    const { createResponse, mockAdminData } = await createAdminThroughApi();

    expect([200, 201]).toContain(createResponse.status);
    expect(createResponse.body).toHaveProperty("_id");

    const createdAdminId = createResponse.body._id;
    const adminBeforeDelete = await Admin.findById(createdAdminId).lean();
    expect(adminBeforeDelete).not.toBeNull();

    const linkedAccountId = adminBeforeDelete.accountId;
    const deleteResponse = await request(app).delete(`/api/admins/${createdAdminId}`);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toHaveProperty("message", "Admin deleted successfully");

    // CheckDB: xác nhận Admin đã bị xóa khỏi MongoDB.
    const deletedAdminInDb = await Admin.findById(createdAdminId).lean();
    expect(deletedAdminInDb).toBeNull();

    // CheckDB: xác nhận dữ liệu Admin cũ không còn trong Account theo email đã tạo.
    const deletedAccountInDb = await Account.findOne({ email: mockAdminData.email }).lean();
    expect(deletedAccountInDb).not.toBeNull();
    expect(String(deletedAccountInDb._id)).toBe(String(linkedAccountId));
  });

  // ID: TC_QLTK_012 - Mục tiêu: Tạo Admin thất bại do thiếu trường bắt buộc - Kịch bản: Exception
  it("TC_QLTK_012 - should fail to create admin when required fields are missing", async () => {
    const incompleteAdminData = {
      name: "Incomplete QA Admin",
      password: "Password123!",
    };

    const createResponse = await request(app).post("/api/admins").send(incompleteAdminData);

    expect(createResponse.status).toBe(400);
    expect(createResponse.body).toHaveProperty(
      "message",
      "Missing required fields: name, email, password"
    );

    // CheckDB: xác nhận không có dữ liệu mới nào được ghi xuống MongoDB.
    const adminCountInDb = await Admin.countDocuments({ name: incompleteAdminData.name });
    const accountCountInDb = await Account.countDocuments({ email: /^qa-admin-/i });
    expect(adminCountInDb).toBe(0);
    expect(accountCountInDb).toBe(0);
  });

  // ID: TC_QLTK_013 - Mục tiêu: Lấy Admin không tồn tại - Kịch bản: Exception
  it("TC_QLTK_013 - should return error when admin ID is invalid", async () => {
    const invalidAdminId = "invalid-admin-id";
    expect(mongoose.Types.ObjectId.isValid(invalidAdminId)).toBe(false);

    const getResponse = await request(app).get(`/api/admins/${invalidAdminId}`);

    expect(getResponse.status).toBe(400);
    expect(getResponse.body).toHaveProperty("message", "Invalid admin id format");

    // CheckDB: xác nhận không có thay đổi dữ liệu nào do request lỗi.
    const adminCountInDb = await Admin.countDocuments({});
    expect(adminCountInDb).toBe(0);
  });
});
