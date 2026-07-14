'use client';

import { useEffect } from 'react';

export default function RegisterPage() {

  useEffect(() => {
    window.location.href = '/auth/login';
  }, []);

  return null;
}
