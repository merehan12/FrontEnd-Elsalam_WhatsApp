
// // src/routes/ProtectedRoute.js
// import React from "react";
// import { useSelector } from "react-redux";
// import { Navigate, Outlet, useLocation } from "react-router-dom";

// export default function ProtectedRoute({ children }) {
//   const location = useLocation();

//   // نفس شكل الـ state في authSlice
//   const { isAuthenticated, refresh } = useSelector((s) => s.auth);

//   // مفيش access ومفيش refresh → مفيش جلسة خالص
//   if (!isAuthenticated && !refresh) {
//     return (
//       <Navigate
//         to="/login"
//         replace
//         state={{ from: location }} // لو حبيتي ترجعيه لنفس الصفحة بعد اللوجين
//       />
//     );
//   }

//   // لو فيه refresh حتى لو isAuthenticated = false
//   // نسمح له يدخل، والسيلنت ريفرش (في App مثلاً) هيظبط التوكن
//   return children ?? <Outlet />;
// }


import React from "react";
import { useSelector } from "react-redux";
import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const { isAuthenticated } = useSelector((s) => s.auth);

  // لو مش عامل لوجين (مفيش access صالح) → روّحيه على صفحة اللوجين
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  // لو لوجين خلاص → إعرض الصفحات المحمية
  return children ?? <Outlet />;
}
