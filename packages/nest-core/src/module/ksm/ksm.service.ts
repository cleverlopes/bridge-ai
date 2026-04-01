import {
  Injectable,
  OnModuleInit,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { Secret, SecretScope } from '../../persistence/entity/secret.entity';
import { SecretAudit } from '../../persistence/entity/secret-audit.entity';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

interface EncryptedBlob {
  iv: string;
  tag: string;
  ciphertext: string;
  version: number;
}

@Injectable()
export class KsmService implements OnModuleInit {
  private readonly logger = new Logger(KsmService.name);
  private masterKey!: Buffer;

  constructor(
    @InjectRepository(Secret)
    private readonly secretRepo: Repository<Secret>,
    @InjectRepository(SecretAudit)
    private readonly auditRepo: Repository<SecretAudit>,
  ) {}

  onModuleInit() {
    const keyB64 = process.env['BRIDGE_MASTER_KEY'];
    if (!keyB64) {
      throw new Error('BRIDGE_MASTER_KEY environment variable is required');
    }
    const keyBuf = Buffer.from(keyB64, 'base64');
    if (keyBuf.length !== 32) {
      throw new Error('BRIDGE_MASTER_KEY must be exactly 32 bytes (base64-encoded)');
    }
    this.masterKey = keyBuf;
    this.logger.log('KSM initialized');
  }

  async createSecret(
    name: string,
    value: string,
    scope: SecretScope,
    scopeId?: string,
  ): Promise<Secret> {
    const encryptedValue = this.encrypt(value);
    const secret = this.secretRepo.create({
      name,
      scope,
      scopeId: scopeId ?? null,
      encryptedValue,
      algorithm: ALGORITHM,
      keyVersion: 1,
    });
    const saved = await this.secretRepo.save(secret);
    await this.writeAudit(saved.id, 'create', 'KsmService', scopeId);
    return saved;
  }

  async getSecret(
    name: string,
    scope: SecretScope,
    scopeId?: string,
    callerModule = 'KsmService',
    callerProjectId?: string,
  ): Promise<string> {
    const secret = await this.findSecret(name, scope, scopeId);
    await this.writeAudit(secret.id, 'read', callerModule, callerProjectId);
    return this.decrypt(secret.encryptedValue);
  }

  async rotateSecret(
    name: string,
    newValue: string,
    scope: SecretScope,
    scopeId?: string,
  ): Promise<void> {
    const secret = await this.findSecret(name, scope, scopeId);
    const encryptedValue = this.encrypt(newValue);
    await this.secretRepo.update(secret.id, {
      encryptedValue,
      keyVersion: secret.keyVersion + 1,
    });
    await this.writeAudit(secret.id, 'rotate', 'KsmService', scopeId);
  }

  private async findSecret(
    name: string,
    scope: SecretScope,
    scopeId?: string,
  ): Promise<Secret> {
    const where =
      scopeId === undefined
        ? { name, scope, scopeId: IsNull() }
        : { name, scope, scopeId };

    const secret = await this.secretRepo.findOne({
      where,
    });
    if (!secret) {
      throw new NotFoundException(`Secret '${name}' not found`);
    }
    return secret;
  }

  private encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.masterKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    const blob: EncryptedBlob = {
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      ciphertext: encrypted.toString('base64'),
      version: 1,
    };
    return JSON.stringify(blob);
  }

  private decrypt(encryptedJson: string): string {
    let blob: EncryptedBlob;
    try {
      blob = JSON.parse(encryptedJson) as EncryptedBlob;
    } catch {
      throw new UnauthorizedException('Invalid encrypted secret format');
    }

    const iv = Buffer.from(blob.iv, 'base64');
    const tag = Buffer.from(blob.tag, 'base64');
    const ciphertext = Buffer.from(blob.ciphertext, 'base64');

    if (iv.length !== IV_BYTES || tag.length !== AUTH_TAG_BYTES) {
      throw new UnauthorizedException('Invalid encrypted secret structure');
    }

    const decipher = createDecipheriv(ALGORITHM, this.masterKey, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  private async writeAudit(
    secretId: string,
    action: SecretAudit['action'],
    callerModule: string,
    callerProjectId?: string,
  ): Promise<void> {
    const audit = this.auditRepo.create({
      secretId,
      action,
      callerModule,
      callerProjectId: callerProjectId ?? null,
    });
    await this.auditRepo.save(audit);
  }
}
