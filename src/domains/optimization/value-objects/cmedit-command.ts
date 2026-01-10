/**
 * CmeditCommand Value Object
 *
 * Command for Ericsson Network Manager configuration changes.
 * Generates validated cmedit command strings.
 */

export interface ManagedObject {
  readonly subNetwork: string;
  readonly meContext: string;
  readonly managedElement: string;
  readonly additionalPath?: string;
}

export interface VerificationStep {
  readonly description: string;
  readonly command: string;
  readonly expectedOutput: string;
  readonly timeout: number; // milliseconds
}

export type ParameterValue = number | string | boolean;

export class CmeditCommand {
  constructor(
    public readonly command: 'set' | 'get' | 'create' | 'delete',
    public readonly targetMO: ManagedObject,
    public readonly parameter: string,
    public readonly value: ParameterValue,
    public readonly verificationSteps: ReadonlyArray<VerificationStep>
  ) {
    Object.freeze(this);
    Object.freeze(this.targetMO);
    Object.freeze(this.verificationSteps);
  }

  /**
   * Generate the MO path string
   */
  getMOPath(): string {
    let path = `SubNetwork=${this.targetMO.subNetwork}`;
    path += `,MeContext=${this.targetMO.meContext}`;
    path += `,ManagedElement=${this.targetMO.managedElement}`;
    if (this.targetMO.additionalPath) {
      path += `,${this.targetMO.additionalPath}`;
    }
    return path;
  }

  /**
   * Generate the complete cmedit command string
   */
  toScript(): string {
    const moPath = this.getMOPath();
    const valueStr = typeof this.value === 'string' ? `"${this.value}"` : String(this.value);
    return `cmedit ${this.command} ${moPath} ${this.parameter}=${valueStr}`;
  }

  /**
   * Generate verification script
   */
  toVerificationScript(): string {
    return this.verificationSteps
      .map((step, i) => `# Step ${i + 1}: ${step.description}\n${step.command}`)
      .join('\n\n');
  }

  /**
   * Create a rollback command (for 'set' commands)
   */
  createRollback(originalValue: ParameterValue): CmeditCommand | null {
    if (this.command !== 'set') {
      return null;
    }
    return new CmeditCommand(
      'set',
      this.targetMO,
      this.parameter,
      originalValue,
      this.verificationSteps
    );
  }

  /**
   * Value equality
   */
  equals(other: CmeditCommand): boolean {
    return (
      this.command === other.command &&
      this.getMOPath() === other.getMOPath() &&
      this.parameter === other.parameter &&
      this.value === other.value
    );
  }

  toString(): string {
    return this.toScript();
  }

  toJSON(): object {
    return {
      command: this.command,
      moPath: this.getMOPath(),
      parameter: this.parameter,
      value: this.value,
      script: this.toScript(),
      verificationStepCount: this.verificationSteps.length
    };
  }
}
