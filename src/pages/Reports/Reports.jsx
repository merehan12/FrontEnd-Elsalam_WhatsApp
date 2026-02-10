// src/pages/Reports/ReportsPage.jsx
import React, { useEffect, useMemo } from "react";
import {
  BarChart3,
  MessageCircle,
  Users,
  Clock,
  TrendingUp,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import {
  fetchConversations,
  selectConversationList,
} from "../../store/slices/conversationsSlice";
import { fetchUsers, selectUsersProjected } from "../../store/slices/usersSlice";


export default function ReportsPage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const isRTL = typeof document !== "undefined" && document.dir === "rtl";

  // بيانات من الستور
  const conversations = useSelector(selectConversationList);
  const users = useSelector(selectUsersProjected);
  const messagesByConv = useSelector((s) => s.messages?.byConv || {}); // { [convId]: Message[] }

  useEffect(() => {
    dispatch(fetchConversations({ filter: "all" }));
    dispatch(fetchUsers());
  }, [dispatch]);

  // === إحصائيات عامة ===
  const stats = useMemo(() => {
    const totalChats = conversations.length;
    const closedChats = conversations.filter(
      (c) => String(c.status || "").toLowerCase() === "closed"
    ).length;
    const assignedChats = conversations.filter((c) => !!c.assigned_to).length;
    const unassignedChats = totalChats - assignedChats;

    // إن كان عندك message_count على مستوى المحادثة:
    const totalMessages = conversations.reduce(
      (acc, c) => acc + (Number(c.message_count) || 0),
      0
    );

    return { totalChats, totalMessages, assignedChats, unassignedChats, closedChats };
  }, [conversations]);

  const assignedPercentage =
    stats.totalChats > 0 ? (stats.assignedChats / stats.totalChats) * 100 : 0;

  // === أداء الموظفين ===
  const staffPerformance = useMemo(() => {
    // 1) رسائل مُرسلة لكل موظف عبر كل المحادثات (من messages.byConv)
    const sentByUser = new Map(); // userId -> count(all)
    const sentByUserInClosed = new Map(); // userId -> count(only in closed)
    const convMeta = new Map();
    for (const c of conversations) {
      convMeta.set(String(c.id), {
        status: String(c.status || "").toLowerCase(),
        assigned_to: c.assigned_to?.id ?? c.assigned_to ?? null,
      });
    }

    for (const convId of Object.keys(messagesByConv)) {
      const list = messagesByConv[convId] || [];
      const meta = convMeta.get(String(convId)) || { status: "open" };
      const isClosedConv = meta.status === "closed";

      for (const m of list) {
        const isAgent =
          String(m.sender || "").toLowerCase() === "agent" ||
          String(m.direction || "").toLowerCase().startsWith("out");

        if (!isAgent) continue;

        const uid = m.raw?.user_id ?? m.raw?.agent_id ?? m.raw?.sender_id ?? null;
        if (uid == null) continue;

        // إجمالي رسائل الموظف
        sentByUser.set(uid, (sentByUser.get(uid) || 0) + 1);
        // رسائل الموظف داخل محادثات مغلقة فقط
        if (isClosedConv) {
          sentByUserInClosed.set(
            uid,
            (sentByUserInClosed.get(uid) || 0) + 1
          );
        }
      }
    }

    // 2) محادثات مغلقة لكل موظف (حسب assigned_to)
    const closedChatsByUser = new Map(); 
    const chatsHandledByUser = new Map(); 

    for (const c of conversations) {
      const assignee =
        c.assigned_to?.id ?? c.assigned_to ?? null; // يقبل {id} أو id مباشر
      if (assignee == null) continue;

      chatsHandledByUser.set(
        assignee,
        (chatsHandledByUser.get(assignee) || 0) + 1
      );

      const isClosed = String(c.status || "").toLowerCase() === "closed";
      if (isClosed) {
        closedChatsByUser.set(
          assignee,
          (closedChatsByUser.get(assignee) || 0) + 1
        );
      }
    }

    // نجمع الإحصائيات النهائية لكل مستخدم
    return users.map((u) => {
      const uid = u.id;
      const chatsHandled = chatsHandledByUser.get(uid) || 0;
      const closedChatsForUser = closedChatsByUser.get(uid) || 0;
      const messagesSentAll = sentByUser.get(uid) || 0;
      const messagesSentInClosed = sentByUserInClosed.get(uid) || 0;

      return {
        id: uid,
        name: u.name,
        chatsHandled,
        messagesSentAll,
        messagesSentInClosed,
        closedChatsForUser,
      };
    });
  }, [users, conversations, messagesByConv]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8 max-w-7xl mx-auto">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <OverviewCard
          title={t("reports.total_chats")}
          value={stats.totalChats}
          icon={<MessageCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />}
          bgColor="bg-blue-100 dark:bg-blue-900/40"
          trend={t("reports.trend_from_last_month", { value: "+12%" })}
        />
        <OverviewCard
          title={t("reports.closed_chats")}
          value={stats.closedChats} // ✅ كان totalMessages، اتحولت لعدد المحادثات المغلقة
          icon={<BarChart3 className="h-6 w-6 text-green-600 dark:text-green-400" />}
          bgColor="bg-green-100 dark:bg-green-900/40"
          trend={t("reports.trend_from_last_month", { value: "+8%" })}
        />
        <OverviewCard
          title={t("reports.assigned_chats")}
          value={stats.assignedChats}
          icon={<Users className="h-6 w-6 text-orange-600 dark:text-orange-400" />}
          bgColor="bg-orange-100 dark:bg-orange-900/40"
          trend={t("reports.of_total_chats", { value: assignedPercentage.toFixed(1) })}
        />
        <OverviewCard
          title={t("reports.unassigned_chats")}
          value={stats.unassignedChats}
          icon={<Clock className="h-6 w-6 text-red-600 dark:text-red-400" />}
          bgColor="bg-red-100 dark:bg-red-900/40"
          trend={t("reports.trend_from_last_month", { value: "-15%" })}
        />
      </div>

      {/* Assignment Status */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t("reports.assignment_status")}
        </h3>
       <ProgressBar
  label={t("reports.assigned_chats")}
  value={stats.assignedChats}
  percent={assignedPercentage}
  barColor="from-[#952D8C] to-[#7A236F]"
  isRTL={isRTL}
/>

<ProgressBar
  label={t("reports.unassigned_chats")}
  value={stats.unassignedChats}
  percent={100 - assignedPercentage}
  barColor="from-gray-400 to-gray-500"
  isRTL={isRTL}
/>

      </div>

      {/* Staff Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("reports.staff_performance")}
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className={`w-full text-sm ${isRTL ? "text-right" : "text-left"}`}>
            <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
              <tr>
                <Th>{t("reports.staff_member")}</Th>
                <Th>{t("reports.chats_handled")}</Th>
                <Th>{t("reports.closed_chats")}</Th>
                {/* <Th>{t("reports.messages_sent_all")}</Th>
                <Th>{t("reports.messages_sent_in_closed")}</Th> */}
              </tr>
            </thead>
            <tbody>
              {staffPerformance.map((row) => (
                <tr key={row.id} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">{row.name}</td>
                  <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{row.chatsHandled}</td>
                  <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{row.closedChatsForUser}</td>                 
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({ children }) {
  return <th className="px-6 py-3">{children}</th>;
}

function OverviewCard({ title, value, icon, bgColor, trend }) {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-300">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${bgColor}`}>{icon}</div>
      </div>
      <div className="mt-4 flex items-center text-sm text-green-600 dark:text-green-400">
        <TrendingUp className="h-4 w-4 mr-1" />
        <span>{trend}</span>
      </div>
    </div>
  );
}

function ProgressBar({ label, value, percent, barColor, isRTL }) {
  return (
    <div className="mb-5">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600 dark:text-gray-300">{label}</span>
        <span className="text-gray-900 dark:text-white font-medium">
          {value} ({percent.toFixed(1)}%)
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
        <div
          className={`bg-gradient-to-r ${barColor} h-2 rounded-full transition-all ${isRTL ? "float-right" : ""}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
