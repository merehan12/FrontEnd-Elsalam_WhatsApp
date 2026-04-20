import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import conversationsReducer from "./slices/conversationsSlice";
import messagesReducer from "./slices/messagesSlice";
import customersReducer from "./slices/customersSlice";
import usersReducer from "./slices/usersSlice";
import timelineReducer from "./slices/timelineSlice";
import { mediaResolverMiddleware } from "./middleware/mediaResolverMiddleware";
import waTemplatesReducer from "./slices/waTemplatesSlice";
export const store = configureStore({
  reducer: {
    auth: authReducer,
    users: usersReducer,
    conversations: conversationsReducer, 
    messages:messagesReducer ,
    customers: customersReducer,
    timeline: timelineReducer,
    waTemplates: waTemplatesReducer,
 },
  middleware: (getDefault) =>
    getDefault({ serializableCheck: false }).concat(mediaResolverMiddleware),

});

export default store;
