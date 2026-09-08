export default function validateEnv(config: Record<string, unknown>) {
  if (process.env.NODE_ENV === "test") return config;

  const requiredKeys = ["PORT"] as const;
  const missing = requiredKeys.filter((key) => {
    const value = config[key];
    return typeof value !== "string" || value.trim().length === 0;
  });

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return config;
}
