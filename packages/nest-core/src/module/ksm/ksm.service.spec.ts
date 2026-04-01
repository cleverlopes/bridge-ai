import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { KsmService } from './ksm.service';
import { Secret, SecretScope } from '../../persistence/entity/secret.entity';
import { SecretAudit } from '../../persistence/entity/secret-audit.entity';

const TEST_MASTER_KEY = 'dGVzdC1rZXktdGhpcy1pcy0zMi1ieXRlcy1sb25n';

const makeSecretRepo = (): jest.Mocked<Repository<Secret>> =>
  ({
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  }) as unknown as jest.Mocked<Repository<Secret>>;

const makeAuditRepo = (): jest.Mocked<Repository<SecretAudit>> =>
  ({
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  }) as unknown as jest.Mocked<Repository<SecretAudit>>;

describe('KsmService', () => {
  let service: KsmService;
  let secretRepo: jest.Mocked<Repository<Secret>>;
  let auditRepo: jest.Mocked<Repository<SecretAudit>>;
  const originalKey = process.env['BRIDGE_MASTER_KEY'];

  beforeEach(() => {
    process.env['BRIDGE_MASTER_KEY'] = TEST_MASTER_KEY;
    secretRepo = makeSecretRepo();
    auditRepo = makeAuditRepo();
    service = new KsmService(secretRepo, auditRepo);
    service.onModuleInit();
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env['BRIDGE_MASTER_KEY'] = originalKey;
    } else {
      delete process.env['BRIDGE_MASTER_KEY'];
    }
  });

  describe('onModuleInit()', () => {
    it('throws if BRIDGE_MASTER_KEY is not set', () => {
      delete process.env['BRIDGE_MASTER_KEY'];
      const svc = new KsmService(secretRepo, auditRepo);
      expect(() => svc.onModuleInit()).toThrow('BRIDGE_MASTER_KEY environment variable is required');
    });

    it('initializes with a valid base64-32-byte key', () => {
      process.env['BRIDGE_MASTER_KEY'] = TEST_MASTER_KEY;
      const svc = new KsmService(secretRepo, auditRepo);
      expect(() => svc.onModuleInit()).not.toThrow();
    });
  });

  describe('createSecret()', () => {
    it('stores encrypted value (not plaintext) in repository', async () => {
      const plaintext = 'super-secret-value';
      const fakeSecret = { id: 'secret-1', encryptedValue: 'encrypted-blob' } as Secret;
      secretRepo.create.mockReturnValue(fakeSecret);
      secretRepo.save.mockResolvedValue(fakeSecret);
      auditRepo.create.mockReturnValue({} as SecretAudit);
      auditRepo.save.mockResolvedValue({} as SecretAudit);

      await service.createSecret('my-key', plaintext, 'global' as SecretScope);

      const createCall = secretRepo.create.mock.calls[0]![0] as Partial<Secret>;
      expect(createCall['encryptedValue']).not.toBe(plaintext);
      expect(createCall['encryptedValue']).not.toContain(plaintext);
    });

    it('sets algorithm to aes-256-gcm', async () => {
      const fakeSecret = { id: 'secret-1', encryptedValue: '{}' } as Secret;
      secretRepo.create.mockReturnValue(fakeSecret);
      secretRepo.save.mockResolvedValue(fakeSecret);
      auditRepo.create.mockReturnValue({} as SecretAudit);
      auditRepo.save.mockResolvedValue({} as SecretAudit);

      await service.createSecret('key', 'value', 'global' as SecretScope);

      const createCall = secretRepo.create.mock.calls[0]![0] as Partial<Secret>;
      expect(createCall['algorithm']).toBe('aes-256-gcm');
    });

    it('writes an audit record after creating', async () => {
      const fakeSecret = { id: 'secret-abc' } as Secret;
      secretRepo.create.mockReturnValue(fakeSecret);
      secretRepo.save.mockResolvedValue(fakeSecret);
      auditRepo.create.mockReturnValue({} as SecretAudit);
      auditRepo.save.mockResolvedValue({} as SecretAudit);

      await service.createSecret('k', 'v', 'global' as SecretScope);

      expect(auditRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSecret()', () => {
    it('returns original plaintext after encrypt→decrypt cycle', async () => {
      const plaintext = 'my-api-key-12345';

      // Capture the encrypted value that createSecret stores
      let storedEncrypted = '';
      secretRepo.create.mockImplementation((data) => {
        storedEncrypted = (data as Partial<Secret>).encryptedValue ?? '';
        return { ...data } as Secret;
      });
      secretRepo.save.mockImplementation(async (entity) => entity as Secret);
      auditRepo.create.mockReturnValue({} as SecretAudit);
      auditRepo.save.mockResolvedValue({} as SecretAudit);

      await service.createSecret('my-key', plaintext, 'global' as SecretScope);

      // Set up getSecret to return the stored encrypted value
      secretRepo.findOne.mockResolvedValue({
        id: 'secret-1',
        encryptedValue: storedEncrypted,
      } as Secret);

      const result = await service.getSecret('my-key', 'global' as SecretScope);

      expect(result).toBe(plaintext);
    });

    it('throws NotFoundException when secret does not exist', async () => {
      secretRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getSecret('nonexistent', 'global' as SecretScope),
      ).rejects.toThrow(NotFoundException);
    });

    it('writes an audit record on successful read', async () => {
      const plaintext = 'value';
      let storedEncrypted = '';
      secretRepo.create.mockImplementation((data) => {
        storedEncrypted = (data as Partial<Secret>).encryptedValue ?? '';
        return { ...data } as Secret;
      });
      secretRepo.save.mockImplementation(async (entity) => entity as Secret);
      auditRepo.create.mockReturnValue({} as SecretAudit);
      auditRepo.save.mockResolvedValue({} as SecretAudit);

      await service.createSecret('k', plaintext, 'global' as SecretScope);
      auditRepo.save.mockClear();

      secretRepo.findOne.mockResolvedValue({
        id: 'secret-1',
        encryptedValue: storedEncrypted,
      } as Secret);
      await service.getSecret('k', 'global' as SecretScope);

      expect(auditRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('rotateSecret()', () => {
    it('changes the encrypted value on rotate', async () => {
      const originalPlaintext = 'original-value';
      let storedEncrypted = '';

      secretRepo.create.mockImplementation((data) => {
        storedEncrypted = (data as Partial<Secret>).encryptedValue ?? '';
        return { ...data, id: 'secret-1', keyVersion: 1 } as Secret;
      });
      secretRepo.save.mockImplementation(async (entity) => entity as Secret);
      auditRepo.create.mockReturnValue({} as SecretAudit);
      auditRepo.save.mockResolvedValue({} as SecretAudit);
      secretRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      await service.createSecret('my-key', originalPlaintext, 'global' as SecretScope);

      secretRepo.findOne.mockResolvedValue({
        id: 'secret-1',
        encryptedValue: storedEncrypted,
        keyVersion: 1,
      } as Secret);

      await service.rotateSecret('my-key', 'new-value', 'global' as SecretScope);

      const updateCall = secretRepo.update.mock.calls[0] as [string, Partial<Secret>];
      expect(updateCall[1].encryptedValue).not.toBe(storedEncrypted);
      expect(updateCall[1].encryptedValue).not.toBe(originalPlaintext);
    });

    it('increments keyVersion on rotate', async () => {
      secretRepo.findOne.mockResolvedValue({
        id: 'secret-1',
        encryptedValue: JSON.stringify({ iv: Buffer.alloc(12).toString('base64'), tag: Buffer.alloc(16).toString('base64'), ciphertext: '', version: 1 }),
        keyVersion: 3,
      } as Secret);
      secretRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      auditRepo.create.mockReturnValue({} as SecretAudit);
      auditRepo.save.mockResolvedValue({} as SecretAudit);

      // We need to spy on update to check the increment
      // First set up a valid encrypted value to avoid decrypt errors
      let storedEncrypted = '';
      const tempService = new KsmService(secretRepo, auditRepo);
      tempService.onModuleInit();

      // Use createSecret to generate valid encrypted data
      const tempRepo = makeSecretRepo();
      tempRepo.create.mockImplementation((data) => {
        storedEncrypted = (data as Partial<Secret>).encryptedValue ?? '';
        return { ...data, id: 's1', keyVersion: 1 } as Secret;
      });
      tempRepo.save.mockImplementation(async (entity) => entity as Secret);
      const tempAuditRepo = makeAuditRepo();
      tempAuditRepo.create.mockReturnValue({} as SecretAudit);
      tempAuditRepo.save.mockResolvedValue({} as SecretAudit);
      const tempSvc = new KsmService(tempRepo, tempAuditRepo);
      tempSvc.onModuleInit();
      await tempSvc.createSecret('k', 'v', 'global' as SecretScope);

      secretRepo.findOne.mockResolvedValue({
        id: 'secret-1',
        encryptedValue: storedEncrypted,
        keyVersion: 3,
      } as Secret);
      secretRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      await service.rotateSecret('k', 'new-v', 'global' as SecretScope);

      const updateCall = secretRepo.update.mock.calls[0] as [string, Partial<Secret>];
      expect(updateCall[1].keyVersion).toBe(4);
    });
  });
});
