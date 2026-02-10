// src/pages/UserProfilePage.jsx
import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams } from "react-router-dom";
import {
  fetchUserById,
  selectUserByIdStatus,
  selectUserByIdError,
  makeSelectProjectedUserById,
} from "../../store/slices/usersSlice";
import ProfilePage from "./ProfilePage";

export default function UserProfilePage() {
  const { id } = useParams();
  const userId = Number(id);
  const dispatch = useDispatch();

  const selectProjected = makeSelectProjectedUserById();
  const user = useSelector((state) => selectProjected(state, userId));
  const status = useSelector((state) => selectUserByIdStatus(state, userId));
  const error = useSelector((state) => selectUserByIdError(state, userId));

  useEffect(() => {
    if (userId && status !== "loading" && !user) {
      dispatch(fetchUserById(userId));
    }
  }, [userId, status, user, dispatch]);

  if (status === "loading") {
    return <div className="p-6 text-gray-600">Loading user...</div>;
  }
  if (status === "failed") {
    return (
      <div className="p-6 text-red-600">
        Error: {typeof error === "string" ? error : JSON.stringify(error)}
      </div>
    );
  }
  if (!user) return <div className="p-6 text-gray-600">No data.</div>;

  return <ProfilePage user={user} />;
}
