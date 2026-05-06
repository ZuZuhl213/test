jest.mock("../src/models/schedule", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  findByIdAndDelete: jest.fn(),
  find: jest.fn(),
}));

jest.mock("../src/models/doctor", () => ({}));

const Schedule = require("../src/models/schedule");
const scheduleController = require("../src/controllers/scheduleController");

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("Schedule Management Unit Tests", () => {
  afterEach(() => {
    // Rollback: reset mock data/state sau mỗi test để không ảnh hưởng test kế tiếp.
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  // ID: TC_QLLT_001 - Mục tiêu: Tạo lịch trình mới thành công - Kịch bản: Chuẩn
  it("SCH_01 should create a schedule successfully with valid input", async () => {
    // Arrange
    const doctorId = "507f1f77bcf86cd799439011";
    const scheduleDate = "2026-06-23T00:00:00.000Z";
    const timeSlots = [
      { startTime: "09:00", endTime: "09:30", isBooked: false },
      { startTime: "09:30", endTime: "10:00", isBooked: false },
    ];

    const req = {
      body: {
        doctor_id: doctorId,
        date: scheduleDate,
        timeSlots,
      },
    };
    const res = createMockRes();

    const createdSchedule = {
      _id: "schedule-001",
      doctor_id: doctorId,
      date: new Date(scheduleDate),
      timeSlots,
    };

    Schedule.findOne.mockResolvedValue(null);
    Schedule.create.mockResolvedValue(createdSchedule);

    // Act
    await scheduleController.createSchedule(req, res);

    // Assert
    // CheckDB: xác nhận kiểm tra trùng lịch và thao tác tạo schedule đã được gọi đúng dữ liệu.
    expect(Schedule.findOne).toHaveBeenCalledWith({
      doctor_id: doctorId,
      date: scheduleDate,
    });
    expect(Schedule.create).toHaveBeenCalledTimes(1);

    const createPayload = Schedule.create.mock.calls[0][0];
    expect(createPayload.doctor_id).toBe(doctorId);
    expect(createPayload.timeSlots).toEqual(timeSlots);
    expect(createPayload.date).toBeInstanceOf(Date);
    expect(createPayload.date.toISOString()).toBe(new Date(scheduleDate).toISOString());

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: "Schedule created successfully",
      schedule: createdSchedule,
    });
  });

  // ID: TC_QLLT_002 - Mục tiêu: Tạo lịch trình mới không thành công do sai ngày - Kịch bản: Ngoại lệ
  it("SCH_02 should return 400 when creating schedule with a past date", async () => {
    // Arrange
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-22T10:00:00.000Z"));

    const req = {
      body: {
        doctor_id: "507f1f77bcf86cd799439011",
        date: "2026-06-21T00:00:00.000Z",
        timeSlots: [{ startTime: "09:00", endTime: "09:30", isBooked: false }],
      },
    };
    const res = createMockRes();

    // Act
    await scheduleController.createSchedule(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Cannot create schedule for past dates",
    });
    // CheckDB: không được truy vấn/ghi DB nếu date đã quá khứ.
    expect(Schedule.findOne).not.toHaveBeenCalled();
    expect(Schedule.create).not.toHaveBeenCalled();
  });

  // ID: TC_QLLT_003 - Mục tiêu: Tạo lịch trình mới không thành công do trùng lịch - Kịch bản: Ngoại lệ
  it("SCH_03 should return 409 when doctor already has schedule on the same date", async () => {
    // Arrange
    const doctorId = "507f1f77bcf86cd799439011";
    const scheduleDate = "2026-06-24T00:00:00.000Z";
    const req = {
      body: {
        doctor_id: doctorId,
        date: scheduleDate,
        timeSlots: [{ startTime: "10:00", endTime: "10:30", isBooked: false }],
      },
    };
    const res = createMockRes();

    Schedule.findOne.mockResolvedValue({
      _id: "existing-schedule-001",
      doctor_id: doctorId,
      date: new Date(scheduleDate),
    });

    // Act
    await scheduleController.createSchedule(req, res);

    // Assert
    // CheckDB: đã check trùng lịch và không tạo mới record.
    expect(Schedule.findOne).toHaveBeenCalledWith({
      doctor_id: doctorId,
      date: scheduleDate,
    });
    expect(Schedule.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: "Schedule already exists for this doctor and date",
    });
  });

  // ID: TC_QLLT_004 - Mục tiêu: Cập nhật lịch trình thành công - Kịch bản: Chuẩn
  it('SCH_04 should update a slot status to "booked" successfully', async () => {
    // Arrange
    const slotId = "slot-001";
    const req = {
      params: { slotId },
      body: { isBooked: true },
    };
    const res = createMockRes();

    const slot = {
      _id: slotId,
      startTime: "09:00",
      endTime: "09:30",
      isBooked: false,
    };

    const scheduleDoc = {
      timeSlots: {
        id: jest.fn().mockReturnValue(slot),
      },
      save: jest.fn().mockResolvedValue(true),
    };

    Schedule.findOne.mockResolvedValue(scheduleDoc);

    // Act
    await scheduleController.updateDoctorScheduleSlot(req, res);

    // Assert
    // CheckDB: xác nhận đã truy vấn slot, cập nhật trạng thái và lưu lại model.
    expect(Schedule.findOne).toHaveBeenCalledWith({ "timeSlots._id": slotId });
    expect(scheduleDoc.timeSlots.id).toHaveBeenCalledWith(slotId);
    expect(slot.isBooked).toBe(true);
    expect(scheduleDoc.save).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Time slot updated successfully",
      slot: {
        _id: slotId,
        startTime: "09:00",
        endTime: "09:30",
        isBooked: true,
      },
    });
  });

  // ID: TC_QLLT_005 - Mục tiêu: Xóa lịch trình thành công - Kịch bản: Chuẩn
  it("SCH_05 should delete schedule successfully", async () => {
    // Arrange
    const scheduleId = "schedule-100";
    const req = { params: { scheduleId } };
    const res = createMockRes();

    const deletedSchedule = {
      _id: scheduleId,
      doctor_id: "507f1f77bcf86cd799439011",
      date: new Date("2026-04-25T00:00:00.000Z"),
    };
    Schedule.findByIdAndDelete.mockResolvedValue(deletedSchedule);

    // Act
    await scheduleController.deleteDoctorSchedule(req, res);

    // Assert
    // CheckDB: xác nhận model đã được gọi xóa đúng scheduleId.
    expect(Schedule.findByIdAndDelete).toHaveBeenCalledWith(scheduleId);
    expect(Schedule.findByIdAndDelete).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Schedule deleted successfully",
      deletedSchedule: {
        _id: deletedSchedule._id,
        doctor_id: deletedSchedule.doctor_id,
        date: deletedSchedule.date,
      },
    });
  });

  // ID: TC_QLLT_006 - Mục tiêu: Tạo lịch trình thất bại do thiếu trường dữ liệu - Kịch bản: Ngoại lệ
  it("TC_QLLT_006 - should return 400 when creating schedule with missing required fields", async () => {
    // Arrange
    const req = {
      body: {
        doctor_id: "507f1f77bcf86cd799439011",
        date: "2026-06-23T00:00:00.000Z",
      },
    };
    const res = createMockRes();

    // Act
    await scheduleController.createSchedule(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Missing required fields",
    });
    // CheckDB: không truy vấn hoặc tạo mới khi payload thiếu timeSlots.
    expect(Schedule.findOne).not.toHaveBeenCalled();
    expect(Schedule.create).not.toHaveBeenCalled();
  });

  // ID: TC_QLLT_007 - Mục tiêu: Tạo lịch trình thất bại do timeSlots rỗng hoặc sai cấu trúc - Kịch bản: Ngoại lệ
  it("TC_QLLT_007 - should return 500 when creating schedule with empty timeSlots or invalid structure", async () => {
    // Arrange
    const req = {
      body: {
        doctor_id: "507f1f77bcf86cd799439011",
        date: "2026-06-23T00:00:00.000Z",
        timeSlots: [],
      },
    };
    const res = createMockRes();

    Schedule.findOne.mockResolvedValue(null);
    Schedule.create.mockRejectedValue(new Error("timeSlots cannot be empty"));

    // Act
    await scheduleController.createSchedule(req, res);

    // Assert
    expect(Schedule.findOne).toHaveBeenCalledWith({
      doctor_id: "507f1f77bcf86cd799439011",
      date: "2026-06-23T00:00:00.000Z",
    });
    expect(Schedule.create).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Error creating schedule",
      error: expect.any(Error),
    });
  });

  // ID: TC_QLLT_008 - Mục tiêu: Tạo lịch trình thất bại do lỗi Server 500 - Kịch bản: Ngoại lệ
  it("TC_QLLT_008 - should return 500 when createSchedule throws server error", async () => {
    // Arrange
    const req = {
      body: {
        doctor_id: "507f1f77bcf86cd799439011",
        date: "2026-06-23T00:00:00.000Z",
        timeSlots: [{ startTime: "09:00", endTime: "09:30", isBooked: false }],
      },
    };
    const res = createMockRes();

    Schedule.findOne.mockResolvedValue(null);
    Schedule.create.mockRejectedValue(new Error("Database connection lost"));

    // Act
    await scheduleController.createSchedule(req, res);

    // Assert
    expect(Schedule.findOne).toHaveBeenCalledTimes(1);
    expect(Schedule.create).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Error creating schedule",
      error: expect.any(Error),
    });
  });

  // ID: TC_QLLT_009 - Mục tiêu: Cập nhật slot thất bại khi isBooked không phải kiểu Boolean - Kịch bản: Ngoại lệ
  it("TC_QLLT_009 - should return 400 when updateDoctorScheduleSlot receives non-boolean isBooked", async () => {
    // Arrange
    const req = {
      params: { slotId: "slot-001" },
      body: { isBooked: "true" },
    };
    const res = createMockRes();

    // Act
    await scheduleController.updateDoctorScheduleSlot(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "isBooked field is required and must be a boolean",
    });
    // CheckDB: không truy vấn DB khi isBooked không hợp lệ.
    expect(Schedule.findOne).not.toHaveBeenCalled();
  });

  // ID: TC_QLLT_010 - Mục tiêu: Cập nhật slot thất bại khi không tìm thấy schedule - Kịch bản: Ngoại lệ
  it("TC_QLLT_010 - should return 404 when updateDoctorScheduleSlot cannot find schedule", async () => {
    // Arrange
    const req = {
      params: { slotId: "slot-not-found" },
      body: { isBooked: true },
    };
    const res = createMockRes();

    Schedule.findOne.mockResolvedValue(null);

    // Act
    await scheduleController.updateDoctorScheduleSlot(req, res);

    // Assert
    expect(Schedule.findOne).toHaveBeenCalledWith({ "timeSlots._id": "slot-not-found" });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Time slot not found",
    });
  });

  // ID: TC_QLLT_011 - Mục tiêu: Cập nhật slot thất bại khi không tìm thấy slot trong schedule - Kịch bản: Ngoại lệ
  it("TC_QLLT_011 - should return 404 when updateDoctorScheduleSlot cannot find slot in schedule", async () => {
    // Arrange
    const req = {
      params: { slotId: "slot-not-found-in-schedule" },
      body: { isBooked: true },
    };
    const res = createMockRes();

    const scheduleDoc = {
      timeSlots: {
        id: jest.fn().mockReturnValue(null),
      },
      save: jest.fn(),
    };

    Schedule.findOne.mockResolvedValue(scheduleDoc);

    // Act
    await scheduleController.updateDoctorScheduleSlot(req, res);

    // Assert
    expect(Schedule.findOne).toHaveBeenCalledWith({
      "timeSlots._id": "slot-not-found-in-schedule",
    });
    expect(scheduleDoc.timeSlots.id).toHaveBeenCalledWith("slot-not-found-in-schedule");
    expect(scheduleDoc.save).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Time slot not found in schedule",
    });
  });

  // ID: TC_QLLT_012 - Mục tiêu: Xóa lịch trình thất bại do thiếu scheduleId - Kịch bản: Ngoại lệ
  it("TC_QLLT_012 - should return 400 when deleting schedule without scheduleId", async () => {
    // Arrange
    const req = { params: {} };
    const res = createMockRes();

    // Act
    await scheduleController.deleteDoctorSchedule(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Schedule ID is required",
    });
    // CheckDB: không có thao tác xóa khi thiếu scheduleId.
    expect(Schedule.findByIdAndDelete).not.toHaveBeenCalled();
  });

  // ID: TC_QLLT_013 - Mục tiêu: Xóa lịch trình thất bại khi không tìm thấy schedule - Kịch bản: Ngoại lệ
  it("TC_QLLT_013 - should return 404 when deleting schedule that does not exist", async () => {
    // Arrange
    const req = { params: { scheduleId: "schedule-not-found" } };
    const res = createMockRes();

    Schedule.findByIdAndDelete.mockResolvedValue(null);

    // Act
    await scheduleController.deleteDoctorSchedule(req, res);

    // Assert
    expect(Schedule.findByIdAndDelete).toHaveBeenCalledWith("schedule-not-found");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Schedule not found",
    });
  });

  // ID: TC_QLLT_014 - Mục tiêu: Lấy lịch trình theo doctor_id thành công - Kịch bản: Standard
  it("TC_QLLT_014 - should get doctor schedule by ID successfully", async () => {
    // Arrange
    const doctorId = "507f1f77bcf86cd799439011";
    const req = { params: { doctor_id: doctorId } };
    const res = createMockRes();

    const schedules = [
      {
        _id: "schedule-201",
        doctor_id: doctorId,
        date: new Date("2026-06-23T00:00:00.000Z"),
      },
    ];

    Schedule.find.mockResolvedValue(schedules);

    // Act
    await scheduleController.getDoctorScheduleByID(req, res);

    // Assert
    expect(Schedule.find).toHaveBeenCalledWith({ doctor_id: doctorId });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(schedules);
  });

  // ID: TC_QLLT_015 - Mục tiêu: Lấy lịch trình theo doctor_id thất bại do sai ID - Kịch bản: Ngoại lệ
  it("TC_QLLT_015 - should return 404 when doctor schedule by ID is not found", async () => {
    // Arrange
    const req = { params: { doctor_id: "invalid-doctor-id" } };
    const res = createMockRes();

    Schedule.find.mockResolvedValue([]);

    // Act
    await scheduleController.getDoctorScheduleByID(req, res);

    // Assert
    expect(Schedule.find).toHaveBeenCalledWith({ doctor_id: "invalid-doctor-id" });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "No schedules found for this doctor",
    });
  });
});
