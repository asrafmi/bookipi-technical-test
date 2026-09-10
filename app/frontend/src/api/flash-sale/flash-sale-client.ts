import { createHttpMethods } from "../http";
import { createHttpClient } from "../http-client";

const FLASH_SALE_API_URL = import.meta.env.VITE_FLASH_SALE_API_BASE_URL;

if (!FLASH_SALE_API_URL) {
  throw new Error('VITE_FLASH_SALE_API_BASE_URL is not set. Check your .env file.');
}

const flashSaleHttpClient = createHttpClient({
  baseURL: FLASH_SALE_API_URL + '/v1',
});

export const flashSale = createHttpMethods(flashSaleHttpClient);
