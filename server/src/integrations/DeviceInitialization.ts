/**
 * Initialize Nest Device
 */

import { NestDeviceAPI, NestDeviceSettings } from '@/lib/types';
import * as http from 'http';

export class DeviceInitialization {

  constructor() {}

  /**
   * Get device key
   */
  async getDeviceKey(device: NestDeviceAPI): Promise<string | null> {
    const url = new URL(`http://${device.deviceIp}:8080/cgi-bin/api/settings`);
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
    
    const data = {initialize: device.deviceId};
    console.log(`[DeviceInitialization] sending ` + JSON.stringify(data));
    return new Promise((resolve) => {
      const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('error', (err) => {
          console.error(`[Device initialization] Failed to update device endpoint. Err: ${err}`);
          resolve(null);
        });

        res.on('end', () => {
          if (res.statusCode !== 200) {
            console.error`[DeviceInitialization] Nest Device API returned ${res.statusCode}.`;
          }

          try {
            const deviceSettings: NestDeviceSettings = JSON.parse(data);
            if (deviceSettings.api_key) {
              resolve(deviceSettings.api_key);
            } else {
              resolve(null);
            }
          } catch (error) {
            console.error('[DeviceInitialization] Failed to parse Nest API. Response: ', error);
            resolve(null);
          }
        });
      });

      req.on('error', () => {
          console.error(`[DeviceInitialization] Could not reach device endpoint. Is the device awake?`);
          resolve(null);
        });

      req.write(JSON.stringify(data));
      req.end();
    });
  }

  /**
   * Get current API endpoint for device
   */
  async getDeviceEndpoint(device: NestDeviceAPI): Promise<string | null> {
    console.log('[DeviceInitialization] Make sure your device is active while the server is checking...')
    return new Promise((resolve, reject) => {
      const url = `http://${device.deviceIp}:8080/cgi-bin/api/settings`;
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
    const url = new URL(`http://${device.deviceIp}:8080/cgi-bin/api/settings`);
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
    const api_key = await this.getDeviceKey(device);
    
    if (api_key) {
      const data = {api_key: api_key, endpoint: endpoint};
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
    } else {
      return false;
    }
  }
}