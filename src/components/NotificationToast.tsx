import React from 'react';
import { AlertItem } from '../types/market';
import { Bell, Flame, X } from 'lucide-react';

interface NotificationToastProps {
  alert: AlertItem | null;
  onClose: () => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = () => {
  return null;
};
