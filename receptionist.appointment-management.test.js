const mongoose = require('mongoose');

jest.mock('../../../src/models/appointment', () => ({
  find: jest.fn(),
  countDocuments: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));

const Appointment = require('../../../src/models/appointment');
const appointmentController = require('../../../src/controllers/appointmentController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('Receptionist Appointment Management Unit Test Skeleton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TC: TC-UT-REC-APM-001
  // CheckDB: Không
  // Rollback: Không
  it('should_get_all_appointments_successfully', async () => {
    const req = { query: {} };
    const res = mockRes();

    const leanMock = jest.fn().mockResolvedValue([{ _id: 'a1', patientSnapshot: { name: 'P1' } }]);
    const limitMock = jest.fn().mockReturnValue({ lean: leanMock });
    const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
    const sortMock = jest.fn().mockReturnValue({ skip: skipMock });
    const selectMock = jest.fn().mockReturnValue({ sort: sortMock });
    Appointment.find.mockReturnValue({ select: selectMock });
    Appointment.countDocuments.mockResolvedValue(1);

    await appointmentController.getAllAppointments(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.any(Array), meta: expect.any(Object) }));
  });

  // TC: TC-UT-REC-APM-002
  // CheckDB: Không
  // Rollback: Không
  it('should_get_all_appointments_with_filters', async () => {
    const req = { query: { status: 'pending', doctor_id: 'd1', page: '1', limit: '10' } };
    const res = mockRes();

    Appointment.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
          }),
        }),
      }),
    });
    Appointment.countDocuments.mockResolvedValue(0);

    await appointmentController.getAllAppointments(req, res);

    expect(Appointment.find).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending', doctor_id: 'd1' }));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  // TC: TC-UT-REC-APM-003
  // CheckDB: Có
  // Rollback: Không
  it('should_update_appointment_successfully', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const req = { params: { id }, body: { reason: 'Updated reason' } };
    const res = mockRes();

    Appointment.findByIdAndUpdate.mockResolvedValue({ _id: id, reason: 'Updated reason' });

    await appointmentController.updateAppointment(req, res);

    expect(Appointment.findByIdAndUpdate).toHaveBeenCalledWith(id, req.body, { new: true });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  // TC: TC-UT-REC-APM-004
  // CheckDB: Có
  // Rollback: Không
  it('should_return_404_when_update_appointment_not_found', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const req = { params: { id }, body: { reason: 'x' } };
    const res = mockRes();

    Appointment.findByIdAndUpdate.mockResolvedValue(null);

    await appointmentController.updateAppointment(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // TC: TC-UT-REC-APM-005 (Bug-hunting)
  // CheckDB: Không
  // Rollback: Không
  // Nghiệp vụ mong muốn validate dữ liệu trước khi save; controller hiện đang pass-through.
  it('should_reject_update_with_invalid_payload', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const req = { params: { id }, body: { timeSlot: '' } };
    const res = mockRes();

    Appointment.findByIdAndUpdate.mockResolvedValue({ _id: id, timeSlot: '' });

    await appointmentController.updateAppointment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // TC: TC-UT-REC-APM-006
  // CheckDB: Không
  // Rollback: Không
  it('should_delete_appointment_successfully', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const req = { params: { id } };
    const res = mockRes();

    Appointment.findByIdAndDelete.mockResolvedValue({ _id: id });

    await appointmentController.deleteAppointment(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Appointment deleted successfully' });
  });

  // TC: TC-UT-REC-APM-007
  // CheckDB: Không
  // Rollback: Không
  it('should_return_400_when_delete_appointment_id_invalid', async () => {
    const req = { params: { id: 'bad-id' } };
    const res = mockRes();

    await appointmentController.deleteAppointment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // TC: TC-UT-REC-APM-008
  // CheckDB: Có
  // Rollback: Không
  it('should_return_404_when_delete_appointment_not_found', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const req = { params: { id } };
    const res = mockRes();

    Appointment.findByIdAndDelete.mockResolvedValue(null);

    await appointmentController.deleteAppointment(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // TC: TC-UT-REC-APM-009
  // CheckDB: Không
  // Rollback: Không
  it('should_return_500_when_get_all_appointments_throws_error', async () => {
    const req = { query: {} };
    const res = mockRes();

    Appointment.find.mockImplementation(() => {
      throw new Error('db crash');
    });

    await appointmentController.getAllAppointments(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
