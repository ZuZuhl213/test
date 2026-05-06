const mongoose = require('mongoose');

jest.mock('../../../src/models/appointment', () => ({
  findById: jest.fn(),
}));

jest.mock('../../../src/models/doctor', () => ({
  findById: jest.fn(),
}));

jest.mock('../../../src/models/schedule', () => ({
  findOne: jest.fn(),
}));

jest.mock('../../../src/helpers/appointmentSnapshot', () => ({
  createPatientSnapshot: jest.fn(),
  createDoctorSnapshot: jest.fn().mockResolvedValue({ name: 'Dr Snapshot' }),
  createSpecialtySnapshot: jest.fn(),
}));

const Appointment = require('../../../src/models/appointment');
const Doctor = require('../../../src/models/doctor');
const Schedule = require('../../../src/models/schedule');
const { createDoctorSnapshot } = require('../../../src/helpers/appointmentSnapshot');

const appointmentController = require('../../../src/controllers/appointmentController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('Receptionist Assign Doctor Unit Test Skeleton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TC: TC-UT-REC-ASG-001
  // CheckDB: Không
  // Rollback: Không
  it('should_require_doctor_id_when_assigning_doctor', async () => {
    const req = { params: { id: new mongoose.Types.ObjectId().toString() }, body: {} };
    const res = mockRes();

    await appointmentController.assignDoctor(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // TC: TC-UT-REC-ASG-002
  // CheckDB: Không
  // Rollback: Không
  it('should_reject_invalid_doctor_id_format', async () => {
    const req = { params: { id: new mongoose.Types.ObjectId().toString() }, body: { doctor_id: 'bad-id' } };
    const res = mockRes();

    await appointmentController.assignDoctor(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // TC: TC-UT-REC-ASG-003
  // CheckDB: Không
  // Rollback: Không
  it('should_return_404_when_appointment_not_found', async () => {
    const req = {
      params: { id: new mongoose.Types.ObjectId().toString() },
      body: { doctor_id: new mongoose.Types.ObjectId().toString() },
    };
    const res = mockRes();

    Appointment.findById.mockResolvedValue(null);

    await appointmentController.assignDoctor(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // TC: TC-UT-REC-ASG-004
  // CheckDB: Có
  // Rollback: Không
  it('should_reject_assign_when_appointment_status_not_waiting_assigned', async () => {
    const req = {
      params: { id: new mongoose.Types.ObjectId().toString() },
      body: { doctor_id: new mongoose.Types.ObjectId().toString() },
    };
    const res = mockRes();

    Appointment.findById.mockResolvedValue({ status: 'pending' });

    await appointmentController.assignDoctor(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // TC: TC-UT-REC-ASG-005
  // CheckDB: Không
  // Rollback: Không
  it('should_return_404_when_doctor_not_found', async () => {
    const req = {
      params: { id: new mongoose.Types.ObjectId().toString() },
      body: { doctor_id: new mongoose.Types.ObjectId().toString() },
    };
    const res = mockRes();

    Appointment.findById.mockResolvedValue({
      _id: req.params.id,
      status: 'waiting_assigned',
      specialty_id: new mongoose.Types.ObjectId(),
      appointmentDate: new Date(),
      timeSlot: '08:00 08:30',
    });
    Doctor.findById.mockResolvedValue(null);

    await appointmentController.assignDoctor(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // TC: TC-UT-REC-ASG-006
  // CheckDB: Không
  // Rollback: Không
  it('should_reject_assign_when_doctor_specialty_not_match', async () => {
    const req = {
      params: { id: new mongoose.Types.ObjectId().toString() },
      body: { doctor_id: new mongoose.Types.ObjectId().toString() },
    };
    const res = mockRes();

    Appointment.findById.mockResolvedValue({
      _id: req.params.id,
      status: 'waiting_assigned',
      specialty_id: new mongoose.Types.ObjectId(),
      appointmentDate: new Date(),
      timeSlot: '08:00 08:30',
    });
    Doctor.findById.mockResolvedValue({ _id: req.body.doctor_id, specialtyId: new mongoose.Types.ObjectId() });

    await appointmentController.assignDoctor(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // TC: TC-UT-REC-ASG-007
  // CheckDB: Không
  // Rollback: Không
  it('should_reject_assign_when_doctor_has_no_schedule_for_date', async () => {
    const specialtyId = new mongoose.Types.ObjectId();
    const req = {
      params: { id: new mongoose.Types.ObjectId().toString() },
      body: { doctor_id: new mongoose.Types.ObjectId().toString() },
    };
    const res = mockRes();

    Appointment.findById.mockResolvedValue({
      _id: req.params.id,
      status: 'waiting_assigned',
      specialty_id: specialtyId,
      appointmentDate: new Date(),
      timeSlot: '08:00 08:30',
      save: jest.fn(),
    });
    Doctor.findById.mockResolvedValue({ _id: req.body.doctor_id, specialtyId });
    Schedule.findOne.mockResolvedValue(null);

    await appointmentController.assignDoctor(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // TC: TC-UT-REC-ASG-008
  // CheckDB: Không
  // Rollback: Không
  it('should_reject_assign_when_timeslot_not_found_in_schedule', async () => {
    const specialtyId = new mongoose.Types.ObjectId();
    const req = {
      params: { id: new mongoose.Types.ObjectId().toString() },
      body: { doctor_id: new mongoose.Types.ObjectId().toString() },
    };
    const res = mockRes();

    Appointment.findById.mockResolvedValue({
      _id: req.params.id,
      status: 'waiting_assigned',
      specialty_id: specialtyId,
      appointmentDate: new Date(),
      timeSlot: '09:00 09:30',
      save: jest.fn(),
    });
    Doctor.findById.mockResolvedValue({ _id: req.body.doctor_id, specialtyId });
    Schedule.findOne.mockResolvedValue({ timeSlots: [{ startTime: '08:00', isBooked: false }], save: jest.fn() });

    await appointmentController.assignDoctor(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // TC: TC-UT-REC-ASG-009
  // CheckDB: Không
  // Rollback: Không
  it('should_reject_assign_when_timeslot_already_booked', async () => {
    const specialtyId = new mongoose.Types.ObjectId();
    const req = {
      params: { id: new mongoose.Types.ObjectId().toString() },
      body: { doctor_id: new mongoose.Types.ObjectId().toString() },
    };
    const res = mockRes();

    Appointment.findById.mockResolvedValue({
      _id: req.params.id,
      status: 'waiting_assigned',
      specialty_id: specialtyId,
      appointmentDate: new Date(),
      timeSlot: '08:00 08:30',
      save: jest.fn(),
    });
    Doctor.findById.mockResolvedValue({ _id: req.body.doctor_id, specialtyId });
    Schedule.findOne.mockResolvedValue({ timeSlots: [{ startTime: '08:00', isBooked: true }], save: jest.fn() });

    await appointmentController.assignDoctor(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // TC: TC-UT-REC-ASG-010
  // CheckDB: Có
  // Rollback: Không
  it('should_assign_doctor_successfully_for_waiting_assigned_appointment', async () => {
    const specialtyId = new mongoose.Types.ObjectId();
    const doctorId = new mongoose.Types.ObjectId();
    const appointmentId = new mongoose.Types.ObjectId();
    const req = {
      params: { id: appointmentId.toString() },
      body: { doctor_id: doctorId.toString() },
    };
    const res = mockRes();

    const appointment = {
      _id: appointmentId,
      status: 'waiting_assigned',
      specialty_id: specialtyId,
      appointmentDate: new Date(),
      timeSlot: '08:00 08:30',
      save: jest.fn().mockResolvedValue(true),
    };

    const schedule = {
      timeSlots: [{ startTime: '08:00', isBooked: false, appointment_id: null }],
      save: jest.fn().mockResolvedValue(true),
    };

    Appointment.findById.mockResolvedValue(appointment);
    Doctor.findById.mockResolvedValue({ _id: doctorId, specialtyId });
    Schedule.findOne.mockResolvedValue(schedule);

    await appointmentController.assignDoctor(req, res);

    expect(createDoctorSnapshot).toHaveBeenCalledWith(doctorId);
    expect(appointment.status).toBe('pending');
    expect(appointment.save).toHaveBeenCalled();
    expect(schedule.timeSlots[0].isBooked).toBe(true);
    expect(schedule.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
