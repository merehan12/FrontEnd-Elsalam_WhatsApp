// src/pages/Auth/LoginPage.jsx
import React, { useEffect, useState } from "react";
import { Eye, EyeOff, MessageCircle } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import {
  loginUser,
  clearErrors,
  selectLoginError,
} from "../../store/slices/authSlice";

/* ===== Validation ===== */
const LoginSchema = Yup.object().shape({
  email: Yup.string().required("البريد/اسم المستخدم مطلوب"),
  password: Yup.string()
    .min(3, "كلمة السر على الأقل 3")
    .required("كلمة السر مطلوبة"),
  remember: Yup.boolean(),
});

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { loading, isAuthenticated } = useSelector((s) => s.auth);
  const loginError = useSelector(selectLoginError);

  const [showPassword, setShowPassword] = useState(false);

  /* لو المستخدم مسجل بالفعل حوّله */
  useEffect(() => {
    if (isAuthenticated) navigate("/chats", { replace: true });
  }, [isAuthenticated, navigate]);

  /* امسح أي أخطاء قديمة (خصوصًا أخطاء refresh) عند فتح الصفحة */
  useEffect(() => {
    dispatch(clearErrors());
  }, [dispatch]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-purple-70 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary rounded-full flex items-center justify-center mb-4">
            <MessageCircle className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Salam WhatsApp Management</h1>
          <p className="mt-2 text-gray-600">Sign in to your account</p>
        </div>

        <Formik
          initialValues={{ email: "", password: "", remember: false }}
          validationSchema={LoginSchema}
          onSubmit={async (values, { setSubmitting }) => {
            const res = await dispatch(
              loginUser({
                email: values.email,
                password: values.password,
                remember: values.remember,
              })
            );
            setSubmitting(false);
            if (res.meta.requestStatus === "fulfilled") {
              navigate("/chats", { replace: true });
            }
          }}
        >
          {({ isSubmitting, values, setFieldValue }) => (
            <Form className="mt-8 space-y-6">
              <div className="bg-white p-8 rounded-xl shadow-lg space-y-6">
                {/* Email / Username */}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Email / Username
                  </label>
                  <Field
                    id="email"
                    name="email"
                    type="text"
                    autoComplete="username"
                    placeholder="Enter your email or username"
className="w-full px-3 py-2 border border-gray-300 rounded-lg
focus:outline-none
focus:border-primary
focus:ring-2
focus:ring-primary"                  />
                  <div className="text-red-600 text-sm mt-1">
                    <ErrorMessage name="email" />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Field
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:border-primary
focus:ring-2
focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  <div className="text-red-600 text-sm mt-1">
                    <ErrorMessage name="password" />
                  </div>
                </div>

                {/* Remember me */}
                <div className="flex items-center">
                  <input
                    id="remember"
                    name="remember"
                    type="checkbox"
                    checked={values.remember}
                    onChange={(e) => setFieldValue("remember", e.target.checked)}
                    className="h-4 w-4 text-primary-600 border-gray-300 rounded"
                  />
                  <label htmlFor="remember" className="ml-2 block text-sm text-gray-700">
                    Remember me
                  </label>
                </div>

                {/* Error Box (login only) */}
                {loginError && (
                  <div className="p-3 rounded bg-red-50 text-red-700 text-sm border border-red-200">
                    {loginError}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading || isSubmitting}
                  className="w-full bg-primary  text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading || isSubmitting ? "Signing in..." : "Login"}
                </button>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
}
