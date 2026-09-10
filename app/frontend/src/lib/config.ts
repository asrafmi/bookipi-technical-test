interface RuntimeEnv {
  VITE_FLASH_SALE_DEFAULT_SALE_ID?: string;
  VITE_FLASH_SALE_API_BASE_URL?: string;
}

declare global {
  interface Window {
    __ENV__?: RuntimeEnv;
  }
}

function readEnv(key: keyof RuntimeEnv): string | undefined {
  const runtimeValue = window.__ENV__?.[key];
  if (runtimeValue && !runtimeValue.startsWith("${")) return runtimeValue;
  return import.meta.env[key];
}

interface IConfig {
  flashSale: {
    defaultSaleId: string;
    apiBaseUrl: string;
  };
}

export const config: IConfig = {
  flashSale: {
    defaultSaleId: readEnv("VITE_FLASH_SALE_DEFAULT_SALE_ID") || "default",
    apiBaseUrl: readEnv("VITE_FLASH_SALE_API_BASE_URL") || "http://localhost:3000",
  },
};
