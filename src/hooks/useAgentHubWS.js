// // src/hooks/useAgentHubWS.js
// import { useEffect } from "react";
// import { useDispatch, useSelector } from "react-redux";
// import {
//   startConversationsWS,
//   stopConversationsWS,
// } from "../store/slices/conversationsSlice";

// // عدّلي ده حسب مكان ما مخزنة التوكن
// const selectAccessToken = (state) => state.auth?.accessToken;

// export default function useAgentHubWS() {
//   const dispatch = useDispatch();
//   const token = useSelector(selectAccessToken);

//   useEffect(() => {
//     // لو مفيش توكن → اقفل أي WS شغال
//     if (!token) {
//       dispatch(stopConversationsWS());
//       return;
//     }

//     // عند وجود توكن → افتح /ws/agent/
//     dispatch(startConversationsWS({ token }));

//     // تنظيف لما الكومبوننت يتقفل
//     return () => {
//       dispatch(stopConversationsWS());
//     };
//   }, [token, dispatch]);
// }
