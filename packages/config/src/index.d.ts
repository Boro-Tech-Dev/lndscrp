export interface AppConfig {
    nodeEnv: string;
    databaseUrl: string;
    redisUrl: string;
    apiPort: number;
    webPort: number;
    adminPort: number;
    ollamaBaseUrl: string;
    ollamaModel: string;
    tenantSlug: string;
    seedEnabled: boolean;
    internalApiKey: string;
    storageEndpoint: string;
    storageRegion: string;
    storageAccessKey: string;
    storageSecretKey: string;
    storageBucket: string;
    storageForcePathStyle: boolean;
    storagePublicBaseUrl: string;
}
export declare function getConfig(): AppConfig;
