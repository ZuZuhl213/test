const mongoose = require('mongoose');

jest.mock('../../../src/models/invoice', () => ({
  find: jest.fn(),
  countDocuments: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

jest.mock('../../../src/models/treatment', () => ({
  find: jest.fn(),
}));

jest.mock('../../../src/helpers/query', () => ({
  getPagingParams: jest.fn(() => ({
    page: 1,
    limit: 10,
    skip: 0,
    sort: { issued_at: -1 },
  })),
  buildMeta: jest.fn((total, page, limit) => ({ total, page, limit })),
}));

const Invoice = require('../../../src/models/invoice');
const Treatment = require('../../../src/models/treatment');
const invoiceController = require('../../../src/controllers/invoiceController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('Receptionist Invoice Unit Test Skeleton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TC: TC-UT-REC-INV-001
  // CheckDB: Không
  // Rollback: Không
  it('should_list_invoices_successfully', async () => {
    const req = { query: {} };
    const res = mockRes();

    const invoices = [
      {
        _id: 'i1',
        invoiceNumber: 'INV001',
        issued_at: new Date(),
        totalPrice: 100,
        status: 'Pending',
        treatmentId: {
          _id: 't1',
          healthProfileSnapshot: { ownerName: 'Nguyen Van A', ownerPhone: '0901' },
        },
        payments: [],
      },
    ];

    const execMock = jest.fn().mockResolvedValue(invoices);
    const leanMock = jest.fn().mockReturnValue({ exec: execMock });
    const limitMock = jest.fn().mockReturnValue({ lean: leanMock });
    const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
    const sortMock = jest.fn().mockReturnValue({ skip: skipMock });
    const populateMock = jest.fn().mockReturnValue({ sort: sortMock });
    const selectMock = jest.fn().mockReturnValue({ populate: populateMock });
    Invoice.find.mockReturnValue({ select: selectMock });
    Invoice.countDocuments.mockResolvedValue(1);

    await invoiceController.list(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.any(Array) }));
  });

  // TC: TC-UT-REC-INV-002
  // CheckDB: Không
  // Rollback: Không
  it('should_filter_invoices_by_keyword_using_treatment_snapshot', async () => {
    const req = { query: { q: 'Nguyen' } };
    const res = mockRes();

    Treatment.find.mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([{ _id: 't1' }]) }),
    });

    Invoice.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
            }),
            }),
          }),
        }),
      }),
    });
    Invoice.countDocuments.mockResolvedValue(0);

    await invoiceController.list(req, res);

    expect(Treatment.find).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: [] }));
  });

  // TC: TC-UT-REC-INV-003
  // CheckDB: Không
  // Rollback: Không
  it('should_get_invoice_detail_successfully', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const req = { params: { id } };
    const res = mockRes();

    const leanMock = jest.fn().mockResolvedValue({
      _id: id,
      invoiceNumber: 'INV-01',
      totalPrice: 150,
      status: 'Pending',
      payments: [],
      treatmentId: {
        _id: 't1',
        healthProfileSnapshot: { ownerName: 'Patient 1', ownerPhone: '0902' },
        labOrderSnapshot: { _id: 'l1', totalPrice: 50, items: [] },
        prescriptionSnapshot: { _id: 'p1', totalPrice: 100, items: [] },
      },
    });
    Invoice.findById.mockReturnValue({
      populate: jest.fn().mockReturnValue({ lean: leanMock }),
    });

    await invoiceController.getById(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ _id: id, invoiceNumber: 'INV-01' }));
  });

  // TC: TC-UT-REC-INV-004
  // CheckDB: Không
  // Rollback: Không
  it('should_return_400_when_invoice_id_invalid_for_detail', async () => {
    const req = { params: { id: 'bad-id' } };
    const res = mockRes();

    await invoiceController.getById(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // TC: TC-UT-REC-INV-005
  // CheckDB: Không
  // Rollback: Không
  it('should_return_404_when_invoice_not_found_for_detail', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const req = { params: { id } };
    const res = mockRes();

    Invoice.findById.mockReturnValue({ populate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) });

    await invoiceController.getById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // TC: TC-UT-REC-INV-006
  // CheckDB: Có
  // Rollback: Không
  it('should_update_invoice_status_successfully', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const req = { params: { id }, body: { status: 'Paid' } };
    const res = mockRes();

    Invoice.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: id, invoiceNumber: 'INV001', totalPrice: 100, status: 'Paid', payments: [] }),
    });

    await invoiceController.updateStatus(req, res);

    expect(Invoice.findByIdAndUpdate).toHaveBeenCalledWith(id, { status: 'Paid' }, { new: true, runValidators: true });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'Paid' }));
  });

  // TC: TC-UT-REC-INV-007
  // CheckDB: Không
  // Rollback: Không
  it('should_return_400_when_invoice_status_invalid', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const req = { params: { id }, body: { status: 'DaThanhToan' } };
    const res = mockRes();

    await invoiceController.updateStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // TC: TC-UT-REC-INV-008
  // CheckDB: Không
  // Rollback: Không
  it('should_return_400_when_invoice_id_invalid_for_status_update', async () => {
    const req = { params: { id: 'invalid-id' }, body: { status: 'Pending' } };
    const res = mockRes();

    await invoiceController.updateStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // TC: TC-UT-REC-INV-009
  // CheckDB: Có
  // Rollback: Không
  it('should_return_404_when_invoice_not_found_for_status_update', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const req = { params: { id }, body: { status: 'Cancelled' } };
    const res = mockRes();

    Invoice.findByIdAndUpdate.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    await invoiceController.updateStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // TC: TC-UT-REC-INV-010 (Bug-hunting)
  // CheckDB: Không
  // Rollback: Không
  // Note: PDF export endpoint không có trong backend hiện tại.
  it('should_document_pdf_export_as_not_in_current_backend_scope', async () => {
    expect(true).toBe(true);
  });
});
