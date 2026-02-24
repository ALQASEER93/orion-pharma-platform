import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

describe('CustomersController', () => {
  const listMock = jest.fn();
  const createMock = jest.fn();
  const detailMock = jest.fn();
  const updateMock = jest.fn();

  const customersService = {
    list: listMock,
    create: createMock,
    detail: detailMock,
    update: updateMock,
  } as unknown as CustomersService;

  let controller: CustomersController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new CustomersController(customersService);
  });

  it('lists customers for tenant from request context', async () => {
    const response = [{ id: 'cust-1' }];
    listMock.mockResolvedValueOnce(response);

    const result = await controller.list(
      { user: { tenantId: 'tenant-1' } } as never,
      { q: 'alpha' },
    );

    expect(listMock).toHaveBeenCalledWith('tenant-1', { q: 'alpha' });
    expect(result).toEqual(response);
  });

  it('creates customer using tenant from request', async () => {
    const dto = { name: 'Acme Pharmacy' };
    const response = { id: 'cust-1' };
    createMock.mockResolvedValueOnce(response);

    const result = await controller.create(
      { user: { tenantId: 'tenant-1' } } as never,
      dto,
    );

    expect(createMock).toHaveBeenCalledWith('tenant-1', dto);
    expect(result).toEqual(response);
  });

  it('returns customer details for tenant', async () => {
    const response = { id: 'cust-1' };
    detailMock.mockResolvedValueOnce(response);

    const result = await controller.detail(
      { tenantId: 'tenant-2' } as never,
      'cust-1',
    );

    expect(detailMock).toHaveBeenCalledWith('tenant-2', 'cust-1');
    expect(result).toEqual(response);
  });

  it('updates customer for tenant', async () => {
    const response = { id: 'cust-1', name: 'Updated' };
    updateMock.mockResolvedValueOnce(response);

    const result = await controller.update(
      { user: { tenantId: 'tenant-1' } } as never,
      'cust-1',
      { name: 'Updated' },
    );

    expect(updateMock).toHaveBeenCalledWith('tenant-1', 'cust-1', {
      name: 'Updated',
    });
    expect(result).toEqual(response);
  });
});
