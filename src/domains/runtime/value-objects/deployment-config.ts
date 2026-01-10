/**
 * DeploymentConfiguration Value Object
 *
 * Configuration for deploying agents across different platforms
 * including browser, mobile, and edge server.
 */

export type Platform = 'browser' | 'mobile' | 'edge-server' | 'p2p';
export type DeploymentMode = 'full-browser' | 'edge-cluster' | 'hybrid';

export interface ResourceLimits {
  readonly maxMemoryMB: number;
  readonly maxCpuPercent: number;
  readonly maxStorageMB: number;
  readonly maxNetworkBps: number;
}

export interface P2PConfig {
  readonly relayUrls: string[];
  readonly enablePublicRelays: boolean;
  readonly maxPeers: number;
  readonly timeout: number;
}

export class DeploymentConfiguration {
  constructor(
    public readonly mode: DeploymentMode,
    public readonly platform: Platform,
    public readonly resourceLimits: ResourceLimits,
    public readonly p2pConfig: P2PConfig,
    public readonly wasmBinarySizeKB: number = 364,
    public readonly enableLocalStorage: boolean = true,
    public readonly enableIndexedDB: boolean = true
  ) {
    Object.freeze(this);
    Object.freeze(this.resourceLimits);
    Object.freeze(this.p2pConfig);
  }

  /**
   * Create browser deployment config
   */
  static browser(): DeploymentConfiguration {
    return new DeploymentConfiguration(
      'full-browser',
      'browser',
      {
        maxMemoryMB: 512,
        maxCpuPercent: 50,
        maxStorageMB: 100,
        maxNetworkBps: 1000000
      },
      {
        relayUrls: ['wss://gun.eco/gun'],
        enablePublicRelays: true,
        maxPeers: 10,
        timeout: 30000
      }
    );
  }

  /**
   * Create edge server deployment config
   */
  static edgeServer(): DeploymentConfiguration {
    return new DeploymentConfiguration(
      'edge-cluster',
      'edge-server',
      {
        maxMemoryMB: 2048,
        maxCpuPercent: 80,
        maxStorageMB: 1024,
        maxNetworkBps: 100000000
      },
      {
        relayUrls: [],
        enablePublicRelays: false,
        maxPeers: 50,
        timeout: 5000
      }
    );
  }

  /**
   * Create hybrid deployment config
   */
  static hybrid(): DeploymentConfiguration {
    return new DeploymentConfiguration(
      'hybrid',
      'edge-server',
      {
        maxMemoryMB: 1024,
        maxCpuPercent: 60,
        maxStorageMB: 512,
        maxNetworkBps: 10000000
      },
      {
        relayUrls: ['wss://relay.example.com'],
        enablePublicRelays: false,
        maxPeers: 30,
        timeout: 10000
      }
    );
  }

  /**
   * Estimate monthly cost in USD
   */
  estimateMonthlyCost(): number {
    switch (this.mode) {
      case 'full-browser':
        return 0; // Free - uses public relays
      case 'edge-cluster':
        return 15 + (this.resourceLimits.maxMemoryMB / 512) * 15;
      case 'hybrid':
        return 5 + (this.resourceLimits.maxMemoryMB / 512) * 5;
      default:
        return 0;
    }
  }

  /**
   * Check if configuration is valid for platform
   */
  isValidForPlatform(): boolean {
    if (this.platform === 'browser') {
      return this.resourceLimits.maxMemoryMB <= 512;
    }
    if (this.platform === 'mobile') {
      return this.resourceLimits.maxMemoryMB <= 256;
    }
    return true;
  }

  /**
   * Value equality
   */
  equals(other: DeploymentConfiguration): boolean {
    return (
      this.mode === other.mode &&
      this.platform === other.platform &&
      this.wasmBinarySizeKB === other.wasmBinarySizeKB
    );
  }

  toString(): string {
    return `DeploymentConfig(${this.mode}, ${this.platform}, ~$${this.estimateMonthlyCost()}/mo)`;
  }

  toJSON(): object {
    return {
      mode: this.mode,
      platform: this.platform,
      resourceLimits: this.resourceLimits,
      wasmBinarySizeKB: this.wasmBinarySizeKB,
      estimatedMonthlyCost: this.estimateMonthlyCost()
    };
  }
}
