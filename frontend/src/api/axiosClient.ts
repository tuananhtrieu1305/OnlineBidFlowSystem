import axios from 'axios';
import { createServerConfig } from './server-config';

export const serverConfig = createServerConfig(import.meta.env.VITE_API_BASE_URL);

const axiosClient = axios.create({
  baseURL: serverConfig.apiUrl,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export default axiosClient;
