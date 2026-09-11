import { createHttpMethods } from "../http";
import { createHttpClient } from "../http-client";
import { config } from "../../lib/config";

const flashSaleHttpClient = createHttpClient({
  baseURL: config.flashSale.apiBaseUrl + '/v1',
});

export const flashSale = createHttpMethods(flashSaleHttpClient);
