const mongoose = require("mongoose");

jest.mock("../src/models/medicine", () => {
  const MedicineMock = jest.fn();
  MedicineMock.findById = jest.fn();
  MedicineMock.findByIdAndDelete = jest.fn();
  return MedicineMock;
});

const Medicine = require("../src/models/medicine");
const medicineController = require("../src/controllers/medicineController");

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("Medicine Management Unit Tests", () => {
  afterEach(() => {
    // Rollback: reset trạng thái mock sau mỗi test để không ảnh hưởng test sau.
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  // Test Case ID: MED_01
  it("MED_01 should create medicine successfully with valid data", async () => {
    // Arrange
    const req = {
      body: {
        name: "Paracetamol",
        code: "MED001",
        price: 5000,
        quantity: 100,
        dosageForm: "Vien nen",
        unit: "Vien",
        manufacturer: "DHG Pharma",
        expiryDate: "2027-12-31",
      },
    };
    const res = createMockRes();
    const savedMedicine = { _id: "med-001", ...req.body };
    const saveMock = jest.fn().mockResolvedValue(savedMedicine);

    Medicine.mockImplementation(function mockMedicine(payload) {
      Object.assign(this, payload);
      this.save = saveMock;
    });

    // Act
    await medicineController.create(req, res);

    // Assert
    expect(Medicine).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Paracetamol",
        price: 5000,
        quantity: 100,
      })
    );
    // CheckDB: xác nhận thao tác lưu vào model đã được gọi.
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(savedMedicine);
  });

  // Test Case ID: MED_02
  it("MED_02 should return 400 when price is negative", async () => {
    // Arrange
    const req = {
      body: {
        name: "Aspirin",
        code: "MED002",
        price: -100,
        quantity: 20,
        expiryDate: "2027-12-31",
      },
    };
    const res = createMockRes();

    Medicine.mockImplementation(function mockMedicine() {
      this.save = jest.fn().mockRejectedValue(new Error("Price must be >= 0"));
    });

    // Act
    await medicineController.create(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Price must be >= 0" })
    );
  });

  // Test Case ID: MED_03
  it("MED_03 should return 400 when quantity is negative", async () => {
    // Arrange
    const req = {
      body: {
        name: "Aspirin",
        code: "MED003",
        price: 100,
        quantity: -20,
        expiryDate: "2027-12-31",
      },
    };
    const res = createMockRes();

    Medicine.mockImplementation(function mockMedicine() {
      this.save = jest
        .fn()
        .mockRejectedValue(new Error("Quantity must be >= 0"));
    });

    // Act
    await medicineController.create(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Quantity must be >= 0" })
    );
  });

  // Test Case ID: MED_04
  it("MED_04 should delete medicine successfully", async () => {
    // Arrange
    const medicineId = new mongoose.Types.ObjectId().toString();
    const req = { params: { id: medicineId } };
    const res = createMockRes();

    Medicine.findByIdAndDelete.mockResolvedValue({ _id: medicineId });

    // Act
    await medicineController.remove(req, res);

    // Assert
    // CheckDB: xác nhận thao tác xóa vào model đã được gọi đúng.
    expect(Medicine.findByIdAndDelete).toHaveBeenCalledWith(medicineId);
    expect(Medicine.findByIdAndDelete).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ message: "Medicine deleted" });
  });

  // Test Case ID: MED_05
  it("MED_05 should return 400 when required fields are empty", async () => {
    // Arrange
    const req = {
      body: {
        name: "",
        code: "",
        price: 100,
        quantity: 20,
        expiryDate: "2027-12-31",
      },
    };
    const res = createMockRes();

    Medicine.mockImplementation(function mockMedicine() {
      this.save = jest
        .fn()
        .mockRejectedValue(new Error("Name and code are required"));
    });

    // Act
    await medicineController.create(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Name and code are required" })
    );
  });

  // Test Case ID: MED_06
  it("MED_06 should return 400 when expiry date is in the past", async () => {
    // Arrange
    const req = {
      body: {
        name: "Vitamin C",
        code: "MED009",
        price: 5000,
        quantity: 60,
        expiryDate: "2020-01-01",
      },
    };
    const res = createMockRes();

    Medicine.mockImplementation(function mockMedicine() {
      this.save = jest
        .fn()
        .mockRejectedValue(new Error("Expiry date cannot be in the past"));
    });

    // Act
    await medicineController.create(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Expiry date cannot be in the past" })
    );
  });

  // Test Case ID: MED_07
  it("MED_07 should update medicine successfully with valid data", async () => {
    // Arrange
    const medicineId = new mongoose.Types.ObjectId().toString();
    const req = {
      params: { id: medicineId },
      body: {
        quantity: 150,
        price: 6500,
      },
    };
    const res = createMockRes();

    const medicineDoc = {
      _id: medicineId,
      name: "Paracetamol",
      quantity: 100,
      price: 5000,
      save: jest.fn().mockResolvedValue({
        _id: medicineId,
        name: "Paracetamol",
        quantity: 150,
        price: 6500,
      }),
    };
    Medicine.findById.mockResolvedValue(medicineDoc);

    // Act
    await medicineController.update(req, res);

    // Assert
    // CheckDB: xác nhận model được lấy đúng id và dữ liệu được lưu lại.
    expect(Medicine.findById).toHaveBeenCalledWith(medicineId);
    expect(medicineDoc.save).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 150, price: 6500 })
    );
  });

  // Test Case ID: MED_08
  it("MED_08 should return 400 when update data is invalid", async () => {
    // Arrange
    const medicineId = new mongoose.Types.ObjectId().toString();
    const req = {
      params: { id: medicineId },
      body: {
        quantity: -10,
      },
    };
    const res = createMockRes();

    const medicineDoc = {
      _id: medicineId,
      name: "Paracetamol",
      quantity: 100,
      price: 5000,
      save: jest
        .fn()
        .mockRejectedValue(new Error("Quantity must be >= 0")),
    };
    Medicine.findById.mockResolvedValue(medicineDoc);

    // Act
    await medicineController.update(req, res);

    // Assert
    // CheckDB: xác nhận đã thử lưu và nhận lỗi validation.
    expect(Medicine.findById).toHaveBeenCalledWith(medicineId);
    expect(medicineDoc.save).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Quantity must be >= 0" })
    );
  });
});
