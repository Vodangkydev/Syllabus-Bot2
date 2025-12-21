import React from 'react';
import { Outlet } from 'react-router-dom';

function UserLayout() {
  return (
    <div className="min-h-screen bg-[#F9F9F9]">
      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default UserLayout; 