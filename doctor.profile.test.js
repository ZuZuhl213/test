const mongoose = require('mongoose');

jest.mock('../../../src/models/doctor', () => ({
  findOne: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

jest.mock('../../../src/models/account', () => ({
  findByIdAndUpdate: jest.fn(),
}));

jest.mock('../../../src/middlewares/uploadCloudinary', () => jest.fn());

const Doctor = require('../../../src/models/doctor');
const Account = require('../../../src/models/account');
const uploadCloudinary = require('../../../src/middlewares/uploadCloudinary');
const doctorController = require('../../../src/controllers/doctorController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('Doctor Profile Unit Test Skeleton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TC: TC-UT-DOC-PROF-001
  // CheckDB: Không
  // Rollback: Không
  it('should_return_doctor_profile_by_account_id_successfully', async () => {
    const req = { params: { accountId: new mongoose.Types.ObjectId().toString() } };
    const res = mockRes();

    const populatedDoc = { _id: 'd1', name: 'Dr A' };
    const q2 = { populate: jest.fn().mockResolvedValue(populatedDoc) };
    const q1 = { populate: jest.fn().mockReturnValue(q2) };
    Doctor.findOne.mockReturnValue(q1);

    await doctorController.getDoctorByAccountId(req, res);

    expect(Doctor.findOne).toHaveBeenCalledWith({ accountId: req.params.accountId });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: populatedDoc }));
  });

  // TC: TC-UT-DOC-PROF-002
  // CheckDB: Không
  // Rollback: Không
  it('should_return_400_when_account_id_is_invalid', async () => {
    const req = { params: { accountId: 'invalid-id' } };
    const res = mockRes();

    await doctorController.getDoctorByAccountId(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'accountId không hợp lệ' });
  });

  // TC: TC-UT-DOC-PROF-003
  // CheckDB: Không
  // Rollback: Không
  it('should_return_404_when_doctor_profile_not_found', async () => {
    const req = { params: { accountId: new mongoose.Types.ObjectId().toString() } };
    const res = mockRes();

    const q2 = { populate: jest.fn().mockResolvedValue(null) };
    const q1 = { populate: jest.fn().mockReturnValue(q2) };
    Doctor.findOne.mockReturnValue(q1);

    await doctorController.getDoctorByAccountId(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Không tìm thấy bác sĩ' });
  });

  // TC: TC-UT-DOC-PROF-004
  // CheckDB: Có
  // Rollback: Không
  it('should_update_doctor_name_phone_successfully', async () => {
    const doctorId = new mongoose.Types.ObjectId().toString();
    const req = {
      params: { id: doctorId },
      body: { name: 'Dr Updated', phone: '0901234567' },
    };
    const res = mockRes();

    Doctor.findByIdAndUpdate.mockResolvedValue({ _id: doctorId, accountId: 'a1', ...req.body });

    await doctorController.updateDoctor(req, res);

    expect(Doctor.findByIdAndUpdate).toHaveBeenCalledWith(
      doctorId,
      req.body,
      expect.objectContaining({ new: true, runValidators: true })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  // TC: TC-UT-DOC-PROF-005
  // CheckDB: Có
  // Rollback: Không
  it('should_return_404_when_updating_non_existing_doctor', async () => {
    const req = {
      params: { id: new mongoose.Types.ObjectId().toString() },
      body: { name: 'Nobody' },
    };
    const res = mockRes();

    Doctor.findByIdAndUpdate.mockResolvedValue(null);

    await doctorController.updateDoctor(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Không tìm thấy bác sĩ' });
  });

  // TC: TC-UT-DOC-PROF-006
  // CheckDB: Có
  // Rollback: Không
  it('should_sync_account_avatar_when_doctor_avatar_updated', async () => {
    const doctorId = new mongoose.Types.ObjectId().toString();
    const accountId = new mongoose.Types.ObjectId().toString();
    const req = {
      params: { id: doctorId },
      body: { bio: 'test avatar update' },
      file: { buffer: Buffer.from('avatar') },
    };
    const res = mockRes();

    uploadCloudinary.mockResolvedValue({ secure_url: 'https://cdn.test/avatar.png' });
    Doctor.findByIdAndUpdate.mockResolvedValue({ _id: doctorId, accountId, avatar: 'https://cdn.test/avatar.png' });
    Account.findByIdAndUpdate.mockResolvedValue({ _id: accountId, avatar: 'https://cdn.test/avatar.png' });

    await doctorController.updateDoctor(req, res);

    expect(uploadCloudinary).toHaveBeenCalledTimes(1);
    expect(Account.findByIdAndUpdate).toHaveBeenCalledWith(accountId, {
      avatar: 'https://cdn.test/avatar.png',
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  // TC: TC-UT-DOC-PROF-007
  // CheckDB: Có
  // Rollback: Không
  it('should_update_doctor_bio_successfully', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const req = { params: { id }, body: { bio: 'New bio' } };
    const res = mockRes();

    Doctor.findByIdAndUpdate.mockResolvedValue({ _id: id, bio: 'New bio' });

    await doctorController.updateDoctorBio(req, res);

    expect(Doctor.findByIdAndUpdate).toHaveBeenCalledWith(id, { bio: 'New bio' }, { new: true });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  // TC: TC-UT-DOC-PROF-008
  // CheckDB: Không
  // Rollback: Không
  it('should_return_400_when_bio_is_not_string', async () => {
    const req = { params: { id: new mongoose.Types.ObjectId().toString() }, body: { bio: 123 } };
    const res = mockRes();

    await doctorController.updateDoctorBio(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Bio phải là chuỗi ký tự' });
  });

  // TC: TC-UT-DOC-PROF-009 (Bug-hunting)
  // CheckDB: Không
  // Rollback: Không
  // Theo kỳ vọng nghiệp vụ: số điện thoại cần đúng format trước khi lưu.
  // Test này chủ đích tìm bug, hiện dự kiến FAIL vì controller updateDoctor chưa validate format phone.
  it('should_reject_update_when_phone_format_is_invalid', async () => {
    const doctorId = new mongoose.Types.ObjectId().toString();
    const req = {
      params: { id: doctorId },
      body: { phone: 'abc-not-a-phone' },
    };
    const res = mockRes();

    Doctor.findByIdAndUpdate.mockResolvedValue({ _id: doctorId, phone: req.body.phone });

    await doctorController.updateDoctor(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/phone|số điện thoại/i) }));
  });
});
