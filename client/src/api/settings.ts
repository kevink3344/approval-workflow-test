import apiClient from './client';
import type { SettingResponse } from '../types';

export async function getPublicSetting(key: string): Promise<SettingResponse> {
  const res = await apiClient.get<SettingResponse>(`/settings/${key}`);
  return res.data;
}

export async function updateSetting(key: string, value: string): Promise<SettingResponse> {
  const res = await apiClient.put<SettingResponse>(`/settings/${key}`, { value });
  return res.data;
}