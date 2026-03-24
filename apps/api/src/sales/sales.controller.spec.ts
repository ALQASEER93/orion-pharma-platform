import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

describe('SalesController', () => {
  const listInvoicesMock = jest.fn();
  const createDraftMock = jest.fn();
  const detailInvoiceMock = jest.fn();
  const updateHeaderMock = jest.fn();
  const addLineMock = jest.fn();
  const updateLineMock = jest.fn();
  const deleteLineMock = jest.fn();
  const postInvoiceMock = jest.fn();
  const checkoutMock = jest.fn();

  const salesService = {
    listInvoices: listInvoicesMock,
    createDraft: createDraftMock,
    detailInvoice: detailInvoiceMock,
    updateHeader: updateHeaderMock,
    addLine: addLineMock,
    updateLine: updateLineMock,
    deleteLine: deleteLineMock,
    postInvoice: postInvoiceMock,
    checkout: checkoutMock,
  } as unknown as SalesService;

  let controller: SalesController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new SalesController(salesService);
  });

  it('lists invoices for tenant from request context', async () => {
    const response = [{ id: 'inv-1' }];
    listInvoicesMock.mockResolvedValueOnce(response);

    const result = await controller.listInvoices(
      { user: { tenantId: 'tenant-1' } } as never,
      { q: 'SI' },
    );

    expect(listInvoicesMock).toHaveBeenCalledWith('tenant-1', { q: 'SI' });
    expect(result).toEqual(response);
  });

  it('creates draft invoice with user context', async () => {
    const response = { id: 'inv-1' };
    createDraftMock.mockResolvedValueOnce(response);

    const result = await controller.createDraft(
      { user: { tenantId: 'tenant-1', sub: 'user-1' } } as never,
      { currency: 'JOD' },
    );

    expect(createDraftMock).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ sub: 'user-1' }),
      { currency: 'JOD' },
    );
    expect(result).toEqual(response);
  });

  it('routes pos checkout to service', async () => {
    const response = { id: 'inv-1', status: 'POSTED' };
    checkoutMock.mockResolvedValueOnce(response);

    const payload = {
      idempotencyKey: 'pos-idem-1',
      lines: [{ productId: 'prod-1', qty: 1, unitPrice: 5 }],
      payment: { method: 'CASH', amount: 5 },
    };

    const result = await controller.checkout(
      { user: { tenantId: 'tenant-1', sub: 'user-1' } } as never,
      payload as never,
    );

    expect(checkoutMock).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ sub: 'user-1' }),
      payload,
    );
    expect(result).toEqual(response);
  });
});
