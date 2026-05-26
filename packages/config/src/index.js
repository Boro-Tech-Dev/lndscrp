"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = getConfig;
function getConfig() {
    return {
        nodeEnv: process.env.NODE_ENV ?? "development",
        databaseUrl: process.env.DATABASE_URL ?? "postgresql://landscrape:landscrape_secure_password@localhost:5432/landscrape",
        redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
        apiPort: Number(process.env.API_PORT ?? 4000),
        webPort: Number(process.env.WEB_PORT ?? 3000),
        adminPort: Number(process.env.ADMIN_PORT ?? 3001),
        ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
        ollamaModel: process.env.OLLAMA_MODEL ?? "llama3.1:8b",
        tenantSlug: process.env.LANDSCRAPE_TENANT_SLUG ?? "demo-oncology",
        seedEnabled: (process.env.LANDSCRAPE_SEED ?? "true") === "true",
        internalApiKey: process.env.LANDSCRAPE_INTERNAL_API_KEY ?? "replace_me",
        storageEndpoint: process.env.STORAGE_ENDPOINT ?? "http://minio:9000",
        storageRegion: process.env.STORAGE_REGION ?? "us-east-1",
        storageAccessKey: process.env.STORAGE_ACCESS_KEY ?? process.env.MINIO_ROOT_USER ?? "landscrape",
        storageSecretKey: process.env.STORAGE_SECRET_KEY ?? process.env.MINIO_ROOT_PASSWORD ?? "landscrape_minio_password",
        storageBucket: process.env.STORAGE_BUCKET ?? "landscrape-artifacts",
        storageForcePathStyle: (process.env.STORAGE_FORCE_PATH_STYLE ?? "true") === "true",
        storagePublicBaseUrl: process.env.STORAGE_PUBLIC_BASE_URL ?? "http://localhost:9000"
    };
}
