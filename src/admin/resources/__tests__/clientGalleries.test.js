import {
  describe, it, expect, vi,
} from 'vitest';

const mockQueries = {
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  reorder: vi.fn(),
};
const makeResourceQueries = vi.fn(() => mockQueries);

vi.mock('../../../lib/queries/adminContent', () => ({
  makeResourceQueries: (...args) => makeResourceQueries(...args),
}));

const { clientGalleriesResource, clientGalleriesQueries } = await import('../clientGalleries.js');

describe('clientGalleriesResource config', () => {
  it('points at the client_galleries table, sorted by sort_order', () => {
    expect(clientGalleriesResource.table).toBe('client_galleries');
    expect(clientGalleriesResource.defaultSort).toBe('sort_order');
    expect(clientGalleriesResource.key).toBe('clientGalleries');
  });

  it('is built on makeResourceQueries with its own table and columns', () => {
    expect(makeResourceQueries).toHaveBeenCalledWith('client_galleries', clientGalleriesResource.columns);
    expect(clientGalleriesQueries).toBe(mockQueries);
  });

  it('requires exactly the fields a delivery cannot exist without: title, drive link, access code', () => {
    const required = clientGalleriesResource.fields.filter((f) => f.required).map((f) => f.name);
    expect(required.sort()).toEqual(['accessCode', 'driveUrl', 'title']);
  });

  it('never puts status in fields — ResourceList owns the publish toggle', () => {
    expect(clientGalleriesResource.fields.some((f) => f.name === 'status')).toBe(false);
  });

  it('shows the access code in the list so the owner can re-read it for the couple', () => {
    expect(clientGalleriesResource.listColumns.some((c) => c.name === 'accessCode')).toBe(true);
  });

  it('tells the admin the truth about Drive: this page controls discovery, Google controls admission', () => {
    const drive = clientGalleriesResource.fields.find((f) => f.name === 'driveUrl');
    expect(drive.help).toMatch(/Google controls who the folder admits/);
  });
});
