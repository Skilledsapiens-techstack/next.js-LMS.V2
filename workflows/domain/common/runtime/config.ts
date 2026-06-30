export type ConfigSource = Record<string, string | boolean | number | undefined>;

export class ConfigService {
  constructor(private readonly values: ConfigSource = process.env) {}

  get<TValue = string>(key: string): TValue | undefined {
    return this.values[key] as TValue | undefined;
  }

  getOrThrow<TValue = string>(key: string): TValue {
    const value = this.get<TValue>(key);

    if (value === undefined || value === null || value === '') {
      throw new Error(`Missing required configuration value: ${key}`);
    }

    return value;
  }
}
