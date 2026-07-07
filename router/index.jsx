import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Ledger from '../pages/Ledger';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/ledger" element={<Ledger />} />
        {/* 默认跳转到记账本 */}
        <Route path="*" element={<Navigate to="/ledger" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
