import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PassThrough } from 'node:stream';
import * as Dockerode from 'dockerode';
import type { Container, ContainerInfo, NetworkInspectInfo } from 'dockerode';

const NETWORK_NAME = 'bridge-ai-projects';
const CONTAINER_IMAGE = 'bridge-ai-runner:latest';
const CONTAINER_UID = 1000;

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

@Injectable()
export class DockerService implements OnModuleInit {
  private readonly logger = new Logger(DockerService.name);
  private readonly docker = new Dockerode();

  async onModuleInit(): Promise<void> {
    await this.ensureNetwork();
  }

  async createContainer(projectId: string, workspacePath: string): Promise<string> {
    const name = `bridge-ai-${projectId}`;

    const existing = await this.getContainerByName(name);
    if (existing) {
      this.logger.log(`Container ${name} already exists, reusing`);
      return (await existing.inspect()).Id;
    }

    const container = await this.docker.createContainer({
      name,
      Image: CONTAINER_IMAGE,
      User: String(CONTAINER_UID),
      WorkingDir: '/workspace',
      HostConfig: {
        Binds: [`${workspacePath}:/workspace`],
        NetworkMode: NETWORK_NAME,
        ReadonlyRootfs: true,
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges'],
        Tmpfs: {
          '/tmp': 'rw,noexec,nosuid,size=256m',
        },
      },
      Labels: {
        'bridge-ai.project': projectId,
        'bridge-ai.managed': 'true',
      },
      Cmd: ['/bin/bash', '-c', 'tail -f /dev/null'],
    });

    await container.start();
    const info = await container.inspect();
    this.logger.log(`Created container ${name} (${info.Id.slice(0, 12)})`);
    return info.Id;
  }

  async execInContainer(
    projectId: string,
    command: string[],
    env: Record<string, string> = {},
  ): Promise<ExecResult> {
    const container = await this.getContainer(projectId);
    if (!container) {
      throw new Error(`Container for project ${projectId} not found`);
    }

    const envArray = Object.entries(env).map(([k, v]) => `${k}=${v}`);

    const exec = await container.exec({
      Cmd: command,
      Env: envArray,
      AttachStdout: true,
      AttachStderr: true,
      User: String(CONTAINER_UID),
      WorkingDir: '/workspace',
    });

    return new Promise((resolve, reject) => {
      exec.start({ hijack: true, stdin: false }, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }
        if (!stream) {
          reject(new Error('No exec stream returned'));
          return;
        }

        const stdoutStream = new PassThrough();
        const stderrStream = new PassThrough();

        this.docker.modem.demuxStream(stream, stdoutStream, stderrStream);

        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];

        stdoutStream.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
        stderrStream.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

        stream.on('end', () => {
          exec.inspect().then((inspect) => {
            resolve({
              stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
              stderr: Buffer.concat(stderrChunks).toString('utf-8'),
              exitCode: inspect.ExitCode ?? -1,
            });
          }).catch(reject);
        });

        stream.on('error', reject);
      });
    });
  }

  async stopContainer(projectId: string): Promise<void> {
    const container = await this.getContainer(projectId);
    if (!container) return;

    try {
      await container.stop({ t: 5 });
      this.logger.log(`Stopped container for project ${projectId}`);
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code !== 304 && code !== 404) throw err;
    }
  }

  async removeContainer(projectId: string): Promise<void> {
    const container = await this.getContainer(projectId);
    if (!container) return;

    try {
      await container.remove({ force: true });
      this.logger.log(`Removed container for project ${projectId}`);
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code !== 404) throw err;
    }
  }

  async getContainer(projectId: string): Promise<Container | null> {
    return this.getContainerByName(`bridge-ai-${projectId}`);
  }

  private async getContainerByName(name: string): Promise<Container | null> {
    try {
      const containers = await this.docker.listContainers({
        all: true,
        filters: JSON.stringify({ name: [name] }),
      });

      const match = containers.find((c: ContainerInfo) => c.Names.includes(`/${name}`));
      if (!match) return null;

      return this.docker.getContainer(match.Id);
    } catch {
      return null;
    }
  }

  private async ensureNetwork(): Promise<void> {
    try {
      const networks = await this.docker.listNetworks({
        filters: JSON.stringify({ name: [NETWORK_NAME] }),
      });

      const exists = networks.some((n: NetworkInspectInfo) => n.Name === NETWORK_NAME);
      if (!exists) {
        await this.docker.createNetwork({
          Name: NETWORK_NAME,
          Driver: 'bridge',
          Internal: true,
          Labels: { 'bridge-ai.managed': 'true' },
        });
        this.logger.log(`Created Docker network: ${NETWORK_NAME}`);
      }
    } catch (err) {
      this.logger.warn(`Could not ensure Docker network ${NETWORK_NAME}: ${err instanceof Error ? err.message : err}`);
    }
  }
}
