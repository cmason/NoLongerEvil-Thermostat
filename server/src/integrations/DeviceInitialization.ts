/**
 * Initialize Nest Device
 */

import { NestDeviceAPI, NestDeviceSettings } from '@/lib/types';
import * as http from 'http';

export class DeviceInitialization {

  constructor() {}

  /**
   * Get current API endpoint for device
   */
  async getDeviceEndpoint(device: NestDeviceAPI): Promise<string | null> {
    console.log('[DeviceInitialization] Make sure your device is active while the server is checking...')
    return new Promise((resolve, reject) => {
      const url = `http://${device.deviceIp}:8080/cgi-bin/settings`;
      http.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode !== 200) {
            console.error`[DeviceInitialization] Nest Device API returned ${res.statusCode}.`;
            reject(null);
            return;
          }

          try {
            const deviceSettings: NestDeviceSettings = JSON.parse(data);
            resolve(deviceSettings.cloudregisterurl);
          } catch (error) {
            console.error('[DeviceInitialization] Failed to parse Nest API. Response: ', error);
            reject(null);
          }
        });
      }).on('error', () => {
          console.error(`[DeviceInitialization] Could not reach device endpoint. Is the device awake?`);
          reject(null);
        });
    });
  }

  /**
   * Update Nest Device endpoint
   */
  async updateDeviceEndpoint(device: NestDeviceAPI, endpoint: string): Promise<boolean> {
    const url = new URL(`http://${device.deviceIp}:8080/cgi-bin/settings`);
    const options: http.RequestOptions = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
    };
    
    const data = {api_key: device.credentials, endpoint: endpoint};
    console.log(`[DeviceInitialization] sending ` + JSON.stringify(data));
    return new Promise<boolean>((resolve) => {
      const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('error', (err) => {
          console.error(`[Device initialization] Failed to update device endpoint. Err: ${err}`);
          resolve(false);
        });

        res.on('end', () => {
          if (res.statusCode !== 200) {
            console.error`[DeviceInitialization] Nest Device API returned ${res.statusCode}.`;
          }

          try {
            const deviceSettings: NestDeviceSettings = JSON.parse(data);
            if (deviceSettings.status == 'new' && deviceSettings.cloudregisterurl == `${endpoint}/entry`) {
              console.log(`[DeviceInitialization] Device has been update to point to ${endpoint}.`);
              resolve(true);
            } else {
              console.error(`[DeviceInitialization] Failed to update device endpoint. Response:`);
              console.error(data);
              resolve(false);
            }
          } catch (error) {
            console.error('[DeviceInitialization] Failed to parse Nest API. Response: ', error);
            resolve(false);
          }
        });
      });

      req.on('error', () => {
          console.error(`[DeviceInitialization] Could not reach device endpoint. Is the device awake?`);
          resolve(false);
        });

      req.write(JSON.stringify(data));
      req.end();
    });
  }
}