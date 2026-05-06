const mongoose = require('mongoose');

jest.mock('../../../src/models/doctor', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
}));

jest.mock('../../../src/models/appointment', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

const mockLabOrderSave = jest.fn();
const MockLabOrder = jest.fn().mockImplementation((doc) => ({
  ...doc,
  _id: new mongoose.Types.ObjectId(),
  save: mockLabOrderSave,
}));
MockLabOrder.findById = jest.fn();
jest.mock('../../../src/models/labOrder', () => MockLabOrder);

jest.mock('../../../src/models/service', () => ({
  find: jest.fn(),
}));

jest.mock('../../../src/models/healthProfile', () => ({
  findById: jest.fn(),
}));

const mockPrescriptionSave = jest.fn();
const MockPrescription = jest.fn().mockImplementation((doc) => ({
  ...doc,
  _id: new mongoose.Types.ObjectId(),
  save: mockPrescriptionSave,
}));
MockPrescription.findById = jest.fn();
jest.mock('../../../src/models/prescription', () => MockPrescription);

jest.mock('../../../src/models/medicine', () => ({
  find: jest.fn(),
  updateOne: jest.fn(),
}));

jest.mock('../../../src/models/patient', () => ({
  findById: jest.fn(),
}));

jest.mock('../../../src/models/familyMember', () => ({
  findById: jest.fn(),
}));

const MockInvoice = jest.fn().mockImplementation((doc) => ({
  ...doc,
  _id: new mongoose.Types.ObjectId(),
  save: jest.fn().mockResolvedValue({ _id: new mongoose.Types.ObjectId(), invoiceNumber: 'INV-001' }),
}));
MockInvoice.countDocuments = jest.fn();
jest.mock('../../../src/models/invoice', () => MockInvoice);

jest.mock('../../../src/models/treatment', () => ({
  create: jest.fn(),
}));

const Doctor = require('../../../src/models/doctor');
const Appointment = require('../../../src/models/appointment');
const LabOrder = require('../../../src/models/labOrder');
const Service = require('../../../src/models/service');
const HealthProfile = require('../../../src/models/healthProfile');
const Prescription = require('../../../src/models/prescription');
const Medicine = require('../../../src/models/medicine');
const Treatment = require('../../../src/models/treatment');
const Invoice = require('../../../src/models/invoice');
const Patient = require('../../../src/models/patient');
const FamilyMember = require('../../../src/models/familyMember');

const appointmentController = require('../../../src/controllers/appointmentController');
const labOrderController = require('../../../src/controllers/labOrderController');
const prescriptionController = require('../../../src/controllers/prescriptionController');
const treatmentController = require('../../../src/controllers/treatmentController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('Doctor Examination Unit Test Skeleton', () => {
  let session;

  beforeEach(() => {
    jest.clearAllMocks();
    session = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // TC: TC-UT-DOC-EXAM-001
  // CheckDB: Không
  // Rollback: Không
  it('should_get_doctor_today_appointments_successfully', async () => {
    const req = { params: { accountId: 'acc-1' }, query: {} };
    const res = mockRes();

    Doctor.findOne.mockResolvedValue({ _id: 'doc-1' });
    const leanMock = jest.fn().mockResolvedValue([
      { _id: 'a1', patientSnapshot: { name: 'P' }, specialtySnapshot: { name: 'S' } },
    ]);
    const sortMock = jest.fn().mockReturnValue({ lean: leanMock });
    const populateMock = jest.fn().mockReturnValue({ sort: sortMock });
    const selectMock = jest.fn().mockReturnValue({ populate: populateMock });
    Appointment.find.mockReturnValue({ select: selectMock });

    await appointmentController.getAppointmentsByDoctorToday(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ count: 1 }));
  });

  // TC: TC-UT-DOC-EXAM-002
  // CheckDB: Không
  // Rollback: Không
  it('should_return_404_when_doctor_not_found_for_today_appointments', async () => {
    const req = { params: { accountId: 'acc-missing' }, query: {} };
    const res = mockRes();

    Doctor.findOne.mockResolvedValue(null);

    await appointmentController.getAppointmentsByDoctorToday(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // TC: TC-UT-DOC-EXAM-003
  // CheckDB: Không
  // Rollback: Không
  it('should_return_empty_list_when_no_today_appointments', async () => {
    const req = { params: { accountId: 'acc-1' }, query: {} };
    const res = mockRes();

    Doctor.findOne.mockResolvedValue({ _id: 'doc-1' });
    const leanMock = jest.fn().mockResolvedValue([]);
    const sortMock = jest.fn().mockReturnValue({ lean: leanMock });
    const populateMock = jest.fn().mockReturnValue({ sort: sortMock });
    const selectMock = jest.fn().mockReturnValue({ populate: populateMock });
    Appointment.find.mockReturnValue({ select: selectMock });

    await appointmentController.getAppointmentsByDoctorToday(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ count: 0 }));
  });

  // TC: TC-UT-DOC-EXAM-004
  // CheckDB: Không
  // Rollback: Không
  it('should_return_400_when_creating_lab_order_without_items', async () => {
    const req = { body: { healthProfile_id: new mongoose.Types.ObjectId().toString(), items: [] } };
    const res = mockRes();

    await labOrderController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // TC: TC-UT-DOC-EXAM-005
  // CheckDB: Không
  // Rollback: Không
  it('should_return_400_when_lab_order_health_profile_id_invalid', async () => {
    const req = {
      body: {
        healthProfile_id: 'invalid',
        items: [{ serviceId: new mongoose.Types.ObjectId().toString(), quantity: 1 }],
      },
    };
    const res = mockRes();

    await labOrderController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // TC: TC-UT-DOC-EXAM-006
  // CheckDB: Có
  // Rollback: Không
  it('should_create_lab_order_successfully_with_valid_services', async () => {
    const hpId = new mongoose.Types.ObjectId().toString();
    const svcId = new mongoose.Types.ObjectId().toString();
    const req = {
      body: {
        healthProfile_id: hpId,
        items: [{ serviceId: svcId, quantity: 2, description: 'xray' }],
      },
    };
    const res = mockRes();

    HealthProfile.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: hpId }) });
    Service.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([{ _id: svcId, price: 100 }]) });
    mockLabOrderSave.mockResolvedValue(true);
    const leanMock = jest.fn().mockResolvedValue({ _id: 'lo1', items: [{ serviceId: { _id: svcId, name: 'X-Ray' } }] });
    const pop2 = jest.fn().mockReturnValue({ lean: leanMock });
    const pop1 = jest.fn().mockReturnValue({ populate: pop2 });
    LabOrder.findById.mockReturnValue({ populate: pop1 });

    await labOrderController.create(req, res);

    expect(Service.find).toHaveBeenCalled();
    expect(mockLabOrderSave).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  // TC: TC-UT-DOC-EXAM-007
  // CheckDB: Không
  // Rollback: Có
  it('should_return_400_when_creating_prescription_without_items', async () => {
    const req = { body: { healthProfile_id: new mongoose.Types.ObjectId().toString(), items: [] } };
    const res = mockRes();

    await prescriptionController.create(req, res);

    expect(session.abortTransaction).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  // TC: TC-UT-DOC-EXAM-008
  // CheckDB: Không
  // Rollback: Có
  it('should_return_400_when_prescription_health_profile_id_invalid', async () => {
    const req = {
      body: {
        healthProfile_id: 'bad-id',
        items: [{ medicineId: new mongoose.Types.ObjectId().toString(), quantity: 1, dosage: '1v', frequency: '2/day', duration: '5d', instruction: 'after meal' }],
      },
    };
    const res = mockRes();

    await prescriptionController.create(req, res);

    expect(session.abortTransaction).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  // TC: TC-UT-DOC-EXAM-009
  // CheckDB: Có
  // Rollback: Có
  it('should_create_prescription_and_commit_transaction_successfully', async () => {
    const hpId = new mongoose.Types.ObjectId().toString();
    const medId = new mongoose.Types.ObjectId().toString();
    const req = {
      body: {
        healthProfile_id: hpId,
        items: [{ medicineId: medId, quantity: 1, dosage: '1v', frequency: '2/day', duration: '5d', instruction: 'after meal' }],
      },
    };
    const res = mockRes();

    const hpQuery = { session: jest.fn().mockResolvedValue({ _id: hpId }) };
    HealthProfile.findById.mockReturnValue(hpQuery);

    const medDocs = [{ _id: medId, quantity: 10, price: 50 }];
    const medQuery = { session: jest.fn().mockResolvedValue(medDocs) };
    Medicine.find.mockReturnValue(medQuery);

    mockPrescriptionSave.mockResolvedValue(true);
    const leanMock = jest.fn().mockResolvedValue({
      _id: 'p1',
      createAt: new Date().toISOString(),
      healthProfile_id: hpId,
      totalPrice: 50,
      items: [{ quantity: 1, dosage: '1v', frequency: '2/day', duration: '5d', instruction: 'after meal', medicineId: { _id: medId, name: 'Paracetamol', price: 50 } }],
    });
    const popMock = jest.fn().mockReturnValue({ lean: leanMock });
    Prescription.findById.mockReturnValue({ populate: popMock });

    await prescriptionController.create(req, res);

    expect(Medicine.updateOne).toHaveBeenCalled();
    expect(session.commitTransaction).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  // TC: TC-UT-DOC-EXAM-010
  // CheckDB: Có
  // Rollback: Có
  it('should_abort_transaction_when_prescription_stock_is_insufficient', async () => {
    const hpId = new mongoose.Types.ObjectId().toString();
    const medId = new mongoose.Types.ObjectId().toString();
    const req = {
      body: {
        healthProfile_id: hpId,
        items: [{ medicineId: medId, quantity: 100, dosage: '1v', frequency: '2/day', duration: '5d', instruction: 'after meal' }],
      },
    };
    const res = mockRes();

    HealthProfile.findById.mockReturnValue({ session: jest.fn().mockResolvedValue({ _id: hpId }) });
    Medicine.find.mockReturnValue({ session: jest.fn().mockResolvedValue([{ _id: medId, quantity: 1, name: 'Paracetamol', price: 50 }]) });

    await prescriptionController.create(req, res);

    expect(session.abortTransaction).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  // TC: TC-UT-DOC-EXAM-011
  // CheckDB: Không
  // Rollback: Không
  it('should_return_400_when_create_treatment_missing_required_fields', async () => {
    const req = { body: { doctor: 'd1' } };
    const res = mockRes();

    await treatmentController.createTreatment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Thiếu thông tin bắt buộc' });
  });

  // TC: TC-UT-DOC-EXAM-012
  // CheckDB: Có
  // Rollback: Không
  it('should_create_treatment_and_generate_invoice_when_inputs_are_valid', async () => {
    const hpId = new mongoose.Types.ObjectId().toString();
    const doctorId = new mongoose.Types.ObjectId().toString();
    const appointmentId = new mongoose.Types.ObjectId().toString();
    const prescriptionId = new mongoose.Types.ObjectId().toString();

    const req = {
      body: {
        healthProfile: hpId,
        doctor: doctorId,
        appointment: appointmentId,
        prescription: prescriptionId,
        treatmentDate: new Date().toISOString(),
        diagnosis: 'Tooth pain',
        bloodPressure: '120/80',
        heartRate: 80,
        temperature: 36.7,
        symptoms: 'Pain',
      },
    };
    const res = mockRes();

    HealthProfile.findById.mockResolvedValue({ _id: hpId, ownerModel: 'Patient', ownerId: 'p1', bloodType: 'O', allergies: [], chronicConditions: [] });
    Doctor.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue({ _id: doctorId, name: 'Dr A', phone: '090', specialtyId: { _id: 's1', name: 'General' } }) });
    Appointment.findById.mockResolvedValue({ _id: appointmentId, appointmentDate: new Date(), timeSlot: '08:00', reason: 'Checkup' });
    Appointment.findByIdAndUpdate.mockResolvedValue({ _id: appointmentId, status: 'completed' });
    Patient.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ name: 'Patient A', dob: null, phone: '090', gender: 'male' }) });
    FamilyMember.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    Prescription.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: prescriptionId,
        created_at: new Date().toISOString(),
        totalPrice: 120,
        items: [],
      }),
    });
    Treatment.create.mockResolvedValue({
      _id: 't1',
      toObject: () => ({ _id: 't1', diagnosis: 'Tooth pain' }),
    });
    Invoice.countDocuments.mockResolvedValue(0);

    await treatmentController.createTreatment(req, res);

    expect(Treatment.create).toHaveBeenCalled();
    expect(Invoice).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  // TC: TC-UT-DOC-EXAM-013 (Bug-hunting)
  // CheckDB: Có
  // Rollback: Có (kỳ vọng theo nghiệp vụ)
  // Theo nghiệp vụ "lưu ca khám" cần đồng thời tạo hóa đơn; nếu tạo hóa đơn lỗi thì nên fail toàn bộ.
  // Test này chủ đích tìm bug, hiện dự kiến FAIL vì code đang nuốt lỗi invoice và vẫn trả 201.
  it('should_fail_create_treatment_when_invoice_creation_fails', async () => {
    const hpId = new mongoose.Types.ObjectId().toString();
    const doctorId = new mongoose.Types.ObjectId().toString();
    const appointmentId = new mongoose.Types.ObjectId().toString();
    const prescriptionId = new mongoose.Types.ObjectId().toString();

    const req = {
      body: {
        healthProfile: hpId,
        doctor: doctorId,
        appointment: appointmentId,
        prescription: prescriptionId,
        treatmentDate: new Date().toISOString(),
        diagnosis: 'Gingivitis',
      },
    };
    const res = mockRes();

    HealthProfile.findById.mockResolvedValue({ _id: hpId, ownerModel: 'Patient', ownerId: 'p1' });
    Doctor.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: doctorId,
        name: 'Dr B',
        phone: '090',
        specialtyId: { _id: 's1', name: 'General' },
      }),
    });
    Appointment.findById.mockResolvedValue({ _id: appointmentId, appointmentDate: new Date(), timeSlot: '08:00', reason: 'Checkup' });
    Appointment.findByIdAndUpdate.mockResolvedValue({ _id: appointmentId, status: 'completed' });
    Patient.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ name: 'Patient B' }) });
    Prescription.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: prescriptionId,
        totalPrice: 100,
        items: [],
      }),
    });
    Treatment.create.mockResolvedValue({
      _id: 't2',
      toObject: () => ({ _id: 't2', diagnosis: 'Gingivitis' }),
    });
    Invoice.countDocuments.mockResolvedValue(1);
    MockInvoice.mockImplementationOnce((doc) => ({
      ...doc,
      save: jest.fn().mockRejectedValue(new Error('invoice insert failed')),
    }));

    await treatmentController.createTreatment(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/invoice|error|lỗi/i) }));
  });
});
