interface IConfig {
  flashSale: {
    defaultSaleId: string;
    apiBaseUrl: string;
  }
}

export const config: IConfig = {
  flashSale: {
    defaultSaleId: import.meta.env.VITE_FLASH_SALE_DEFAULT_SALE_ID || "default",
    apiBaseUrl: import.meta.env.VITE_FLASH_SALE_API_BASE_URL || "http://localhost:3000",
  }
};