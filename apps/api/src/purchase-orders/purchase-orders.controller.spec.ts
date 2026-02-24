import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';

describe('PurchaseOrdersController', () => {
  const listMock = jest.fn();
  const detailMock = jest.fn();
  const createMock = jest.fn();

  const purchaseOrdersService = {
    list: listMock,
    detail: detailMock,
    create: createMock,
  } as unknown as PurchaseOrdersService;

  let controller: PurchaseOrdersController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new PurchaseOrdersController(purchaseOrdersService);
  });

  it('lists purchase orders for tenant from request context', async () => {
    const response = [{ id: 'po-1' }];
    listMock.mockResolvedValueOnce(response);

    const result = await controller.list(
      { user: { tenantId: 'tenant-1' } } as never,
      { status: undefined },
    );

    expect(listMock).toHaveBeenCalledWith('tenant-1', {
      status: undefined,
    });
    expect(result).toEqual(response);
  });

  it('returns purchase order details for tenant', async () => {
    const response = { id: 'po-1' };
    detailMock.mockResolvedValueOnce(response);

    const result = await controller.detail(
      { tenantId: 'tenant-2' } as never,
      'po-1',
    );

    expect(detailMock).toHaveBeenCalledWith('tenant-2', 'po-1');
    expect(result).toEqual(response);
  });

  it('creates purchase order using tenant from request', async () => {
    const dto = {
      branchId: 'branch-1',
      supplierId: 'supplier-1',
      lines: [{ productId: 'product-1', quantity: 2, unitPrice: 5 }],
    };
    const response = { id: 'po-1' };
    createMock.mockResolvedValueOnce(response);

    const result = await controller.create(
      { user: { tenantId: 'tenant-1' } } as never,
      dto,
    );

    expect(createMock).toHaveBeenCalledWith('tenant-1', dto);
    expect(result).toEqual(response);
  });
});
