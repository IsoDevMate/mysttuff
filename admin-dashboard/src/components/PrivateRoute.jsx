import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { api } from '../api';

const PrivateRoute = () => {
  // The api object initializes its token from localStorage,
  // so this check is effectively checking for the presence of the token.
  const isAuthenticated = !!api.token;

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export default PrivateRoute;
