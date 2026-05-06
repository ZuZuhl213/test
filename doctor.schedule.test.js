const mongoose = require('mongoose');

jest.mock('../../../src/models/appointment', () => ({
  findById: jest.fn(),
  find: jest.fn(),
}));

jest.mock('../../../src/models/doctor', () => ({
  findOne: jest.fn(),
}));

jest.mock('../../../src/models/patient', () => ({
  findById: jest.fn(),
}));

jest.mock('../../../src/models/account', () => ({
  findById: jest.fn(),
}));

jest.mock('../../../src/helpers/sendMail', () => ({
  sendMail: jest.fn(),
}));

const Appointment = require('../../../src/models/appointment');
const Doctor = require('../../../src/models/doctor');
const Patient = require('../../../src/models/patient');
const Account = require('../../../src/models/account');
const { sendMail } = require('../../../src/helpers/sendMail');

const appointmentController = require('../../../src/controllers/appointmentController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('Doctor Schedule Unit Test Skeleton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TC: TC-UT-DOC-SCH-001
  // CheckDB: Không
  // Rollback: Không
  it('should_get_month_appointments_by_doctor_successfully', async () => {
    const req = {
      params: { accountId: 'acc-1' },
      query: { date: '2026-05-01' },
    };
    const res = mockRes();

    Doctor.findOne.mockResolvedValue({ _id: 'doc-1' });
    const leanMock = jest.fn().mockResolvedValue([{ _id: 'a1', patientSnapshot: { name: 'P1' }, specialtySnapshot: { name: 'S1' } }]);
    const sortMock = jest.fn().mockReturnValue({ lean: leanMock });
    const selectMock = jest.fn().mockReturnValue({ sort: sortMock });
    Appointment.find.mockReturnValue({ select: selectMock });

    await appointmentController.getMonthAppointmentByDoctor(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ count: 1 }));
  });

  // TC: TC-UT-DOC-SCH-002
  // CheckDB: Không
  // Rollback: Không
  it('should_return_400_when_month_query_date_is_invalid', async () => {
    const req = { params: { accountId: 'acc-1' }, query: { date: 'invalid-date' } };
    const res = mockRes();

    Doctor.findOne.mockResolvedValue({ _id: 'doc-1' });

    await appointmentController.getMonthAppointmentByDoctor(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // TC: TC-UT-DOC-SCH-003
  // CheckDB: Không
  // Rollback: Không
  it('should_return_404_when_doctor_not_found_in_month_schedule', async () => {
    const req = { params: { accountId: 'acc-missing' }, query: {} };
    const res = mockRes();

    Doctor.findOne.mockResolvedValue(null);

    await appointmentController.getMonthAppointmentByDoctor(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // TC: TC-UT-DOC-SCH-004
  // CheckDB: Có
  // Rollback: Không
  it('should_confirm_appointment_successfully', async () => {
    const req = { params: { id: new mongoose.Types.ObjectId().toString() } };
    const res = mockRes();

    const appointment = {
      _id: req.params.id,
      status: 'pending',
      booker_id: 'patient-1',
      appointmentDate: new Date().toISOString(),
      timeSlot: '08:00',
      patientSnapshot: { name: 'Patient A' },
      doctorSnapshot: { name: 'Doctor A' },
      specialtySnapshot: { name: 'General' },
      save: jest.fn().mockResolvedValue(true),
    };

    Appointment.findById.mockResolvedValue(appointment);
    Patient.findById.mockResolvedValue({ accountId: 'acc-1', name: 'Patient A' });
    Account.findById.mockResolvedValue({ email: 'patient@example.com' });
    sendMail.mockResolvedValue(true);

    await appointmentController.confirmAppointment(req, res);

    expect(appointment.save).toHaveBeenCalled();
    expect(sendMail).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  // TC: TC-UT-DOC-SCH-005
  // CheckDB: Có
  // Rollback: Không
  it('should_return_404_when_confirming_non_existing_appointment', async () => {
    const req = { params: { id: new mongoose.Types.ObjectId().toString() } };
    const res = mockRes();

    Appointment.findById.mockResolvedValue(null);

    await appointmentController.confirmAppointment(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // TC: TC-UT-DOC-SCH-006
  // CheckDB: Có
  // Rollback: Không
  it('should_confirm_appointment_even_when_patient_not_found_and_skip_email', async () => {
    const req = { params: { id: new mongoose.Types.ObjectId().toString() } };
    const res = mockRes();

    const appointment = {
      _id: req.params.id,
      status: 'pending',
      booker_id: 'patient-404',
      appointmentDate: new Date().toISOString(),
      timeSlot: '10:00',
      save: jest.fn().mockResolvedValue(true),
    };

    Appointment.findById.mockResolvedValue(appointment);
    Patient.findById.mockResolvedValue(null);

    await appointmentController.confirmAppointment(req, res);

    expect(appointment.save).toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  // TC: TC-UT-DOC-SCH-007
  // CheckDB: Có
  // Rollback: Không
  it('should_confirm_appointment_even_when_patient_email_missing_and_skip_email', async () => {
    const req = { params: { id: new mongoose.Types.ObjectId().toString() } };
    const res = mockRes();

    const appointment = {
      _id: req.params.id,
      status: 'pending',
      booker_id: 'patient-1',
      appointmentDate: new Date().toISOString(),
      timeSlot: '11:00',
      save: jest.fn().mockResolvedValue(true),
    };

    Appointment.findById.mockResolvedValue(appointment);
    Patient.findById.mockResolvedValue({ accountId: 'acc-1', name: 'Patient B' });
    Account.findById.mockResolvedValue({});

    await appointmentController.confirmAppointment(req, res);

    expect(sendMail).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  // TC: TC-UT-DOC-SCH-008
  // CheckDB: Không
  // Rollback: Không
  it('should_get_appointments_by_doctor_with_sorted_timeslot_pipeline', async () => {
    const req = { params: { accountId: 'acc-1' }, query: {} };
    const res = mockRes();

    Doctor.findOne.mockResolvedValue({ _id: 'doc-1' });
    const leanMock = jest.fn().mockResolvedValue([
      { _id: 'a1', timeSlot: '08:00', patientSnapshot: { name: 'P1' }, specialtySnapshot: { name: 'S1' } },
      { _id: 'a2', timeSlot: '09:00', patientSnapshot: { name: 'P2' }, specialtySnapshot: { name: 'S1' } },
    ]);
    const sortMock = jest.fn().mockReturnValue({ lean: leanMock });
    const selectMock = jest.fn().mockReturnValue({ sort: sortMock });
    Appointment.find.mockReturnValue({ select: selectMock });

    await appointmentController.getAppointmentsByDoctor(req, res);

    expect(sortMock).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  // TC: TC-UT-DOC-SCH-009 (Bug-hunting)
  // CheckDB: Có
  // Rollback: Không
  // Theo nghiệp vụ: chỉ lịch "Chờ xác nhận" mới được xác nhận.
  // Test này chủ đích tìm bug, hiện dự kiến FAIL với code hiện tại.
  it('should_reject_confirm_when_appointment_status_is_not_pending', async () => {
    const req = { params: { id: new mongoose.Types.ObjectId().toString() } };
    const res = mockRes();

    const appointment = {
      _id: req.params.id,
      status: 'completed',
      booker_id: 'patient-1',
      appointmentDate: new Date().toISOString(),
      timeSlot: '13:00',
      save: jest.fn().mockResolvedValue(true),
    };

    Appointment.findById.mockResolvedValue(appointment);

    await appointmentController.confirmAppointment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/pending|chờ xác nhận/i) })
    );
    expect(appointment.save).not.toHaveBeenCalled();
  });
});
